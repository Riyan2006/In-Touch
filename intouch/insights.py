"""LLM-backed, guarded insight-sentence generation for fired detections."""

# NOTE: This module calls the Gemini API (gemini-3.5-flash) at runtime for
# cost reasons. The entire codebase, including this file, was built using
# Codex with GPT-5.6 as the coding agent.

from __future__ import annotations

import json
import os
import re
from statistics import fmean
from typing import Any

from .detection import detect_dataset
from .generator import generate_dataset


MODEL_NAME = "gemini-3.5-flash"
SYSTEM_INSTRUCTION = """You write single-sentence observations for an app called In Touch, which
notices quiet shifts in a person's relationships — fading, or forming —
before they consciously notice themselves.

Rules, strictly enforced:
- Output exactly ONE sentence. No preamble, no explanation, no quotation marks.
- State what changed and roughly when. Never instruct the reader to do
  anything ("you should call them", "reach out to X" — forbidden).
- Never use scoring, grading, or ranking language ("your closeness score",
  "you rank low with X" — forbidden).
- Never moralize or imply guilt or judgment.
- Be specific: reference actual signal names (calls, texts, meetups) and
  rough magnitudes or durations where given, not vague feelings.
- Tone is plain, warm, matter-of-fact — like a friend noticing something
  out loud, not a notification or an alert.
- For flag_type "decay": note which signal changed first and which held
  on longest, if that data is present.
- For flag_type "rise_existing" or "rise_cold_start": note the change
  without implying it's a big life event — plain observation, not celebration.

Examples of the exact target voice:
1. "You've called Priya 3 fewer times this quarter — it started two months before your texts changed at all."
2. "You haven't seen Arjun in person since March, even though you're still texting most days."
3. "It's been eight months since you and Tanvi were in regular touch."
4. "Something's been quieter with Rohan since May. Not much. Just noted."
5. "Calls with Kabir have nearly tripled since August — quietly, without you really deciding that."
6. "You met Ishaan two months ago. You're already talking as often as people you've known for years."

Match this register exactly. Do not be more dramatic, more clinical, or
more encouraging than these examples."""
STRICT_REMINDER = "\n\nReturn one plain, validated sentence only: no advice, scoring terms, quotes, or second sentence."

SIGNALS = ("meetups", "calls", "texts")
ROW_FIELDS = {"meetups": "meetups", "calls": "calls", "texts": "texts_per_week"}
DENYLIST = ("you should", "reach out", "call them", "consider ", "score", "rank", "rated")


def _row_for_month(contact: dict[str, Any], month: int) -> dict[str, Any]:
    try:
        return next(row for row in contact["monthly_signals"] if row["month"] == month)
    except StopIteration as error:
        raise ValueError(f"No signal row exists for month {month}.") from error


def _raw_change_percentages(contact: dict[str, Any], month_fired: int) -> dict[str, int]:
    current = _row_for_month(contact, month_fired)
    if contact["archetype"] == "cold_start_new":
        starting = _row_for_month(contact, contact["first_appearance_month"])
        # A cold start is measured from this relationship's own first observed
        # month, not against an established friendship's reference frequency.
        baselines = {
            signal: max(starting[ROW_FIELDS[signal]], 0.1)
            for signal in SIGNALS
        }
    else:
        initial = contact["monthly_signals"][:4]
        baselines = {signal: fmean(row[ROW_FIELDS[signal]] for row in initial) for signal in SIGNALS}
    raw_changes = {
        signal: round((current[ROW_FIELDS[signal]] - baseline) / baseline * 100)
        for signal, baseline in baselines.items()
    }
    return raw_changes


def _change_percentages(contact: dict[str, Any], month_fired: int) -> dict[str, int]:
    """Return bounded percentages safe to hand to the LLM or fallback."""
    raw_changes = _raw_change_percentages(contact, month_fired)
    return {signal: max(-300, min(change, 300)) for signal, change in raw_changes.items()}


def _change_start_month(detection_result: dict[str, Any], contact: dict[str, Any]) -> int:
    flag = detection_result["flag"]
    if flag["type"] == "rise_cold_start":
        return contact["first_appearance_month"]
    direction = -1.0 if flag["type"] == "decay" else 1.0
    crossings = [
        score["month"]
        for score in detection_result["monthly_scores"]
        if (score["combined_weighted_z"] < direction if direction < 0 else score["combined_weighted_z"] > direction)
    ]
    return crossings[0] if crossings else flag["month_fired"]


def build_insight_input(contact: dict[str, Any], detection_result: dict[str, Any]) -> dict[str, Any] | None:
    """Convert one fired detector result into the narrow LLM input contract."""
    flag = detection_result["flag"]
    if not flag["fired"]:
        return None
    month_fired = flag["month_fired"]
    changes = _change_percentages(contact, month_fired)
    raw_changes = _raw_change_percentages(contact, month_fired)
    # Rank on the uncapped change so extreme cold-start growth does not turn
    # into a three-way +300% tie. Only bounded values enter the LLM contract.
    ranked = sorted(SIGNALS, key=lambda signal: (-abs(raw_changes[signal]), SIGNALS.index(signal)))
    trigger = flag["trigger_signal"]
    # Cold-start has a composite detector trigger, so expose the largest actual
    # human signal change rather than an internal frequency-calculation label.
    primary = trigger if trigger in SIGNALS else ranked[0]
    if primary != ranked[0]:
        ranked.remove(primary)
        ranked.insert(0, primary)
    start_month = _change_start_month(detection_result, contact)
    return {
        "contact_name": contact["name"],
        "flag_type": flag["type"],
        "primary_signal": primary,
        "primary_signal_change_pct": changes[primary],
        "secondary_signal": ranked[1],
        "secondary_signal_change_pct": changes[ranked[1]],
        "stable_signal": ranked[2],
        "stable_signal_change_pct": changes[ranked[2]],
        "months_since_change_started": month_fired - start_month,
        "month_flag_fired": month_fired,
    }


def validate_insight(sentence: str) -> bool:
    """Reject unsafe, overly long, or non-single-sentence LLM output."""
    stripped = sentence.strip().strip('"')
    if not stripped or len(stripped.split()) > 35:
        return False
    lower = stripped.lower()
    if any(term in lower for term in DENYLIST):
        return False
    terminals = list(re.finditer(r"[.!?]", stripped))
    return not any(stripped[match.end():].strip() for match in terminals)


def _call_gemini(insight_input: dict[str, Any], system_instruction: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY must be set to generate an insight.")
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=json.dumps(insight_input),
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.5,
            max_output_tokens=100,
        ),
    )
    return (response.text or "").strip().strip('"')


def _fallback(insight_input: dict[str, Any]) -> str:
    signal = insight_input["primary_signal"]
    name = insight_input["contact_name"]
    change = insight_input["primary_signal_change_pct"]
    direction = "less" if change < 0 else "more"
    return f"{signal.capitalize()} with {name} have been {abs(change)}% {direction} by month {insight_input['month_flag_fired']}."


def generate_insight(insight_input: dict[str, Any]) -> str:
    """Call Gemini once, retry invalid output once, then use a safe template."""
    for instruction in (SYSTEM_INSTRUCTION, SYSTEM_INSTRUCTION + STRICT_REMINDER):
        try:
            sentence = _call_gemini(insight_input, instruction)
        # An absent SDK/key, quota issue, or transient Gemini failure must not
        # break the app's deterministic pipeline.
        except Exception:
            return _fallback(insight_input)
        if validate_insight(sentence):
            return sentence
    return _fallback(insight_input)


def generate_all_insights(dataset: dict[str, Any], detection_results: list[dict[str, Any]]) -> dict[str, str | None]:
    """Generate one observation for each fired contact and None for all others."""
    results_by_id = {result["contact_id"]: result for result in detection_results}
    insights: dict[str, str | None] = {}
    for contact in dataset["contacts"]:
        insight_input = build_insight_input(contact, results_by_id[contact["contact_id"]])
        insights[contact["contact_id"]] = generate_insight(insight_input) if insight_input else None
    return insights


def run_pipeline() -> None:
    """Run the existing deterministic pipeline followed by insight generation."""
    dataset = generate_dataset()
    detection_results = detect_dataset(dataset)
    flags = {result["contact_id"]: result["flag"]["type"] for result in detection_results}
    insights = generate_all_insights(dataset, detection_results)
    print("contact_id  name    flag type          insight")
    for contact in dataset["contacts"]:
        print(f'{contact["contact_id"]:<11} {contact["name"]:<7} {flags[contact["contact_id"]]:<18} {insights[contact["contact_id"]] or "—"}')


if __name__ == "__main__":
    run_pipeline()
