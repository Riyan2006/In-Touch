"""Explainable decay, existing-contact rise, and cold-start detection."""

from __future__ import annotations

from statistics import fmean, pstdev
from typing import Any, Iterable


WEIGHTS = {"meetups": 0.4, "calls": 0.4, "texts_per_week": 0.2}
REFERENCE_LEVELS = {"meetups": 2.0, "calls": 4.0, "texts_per_week": 20.0}


def calculate_baseline(rows: Iterable[dict[str, Any]], window_size: int = 4) -> dict[str, float | list[int]]:
    """Calculate the reporting baseline from the first available four months."""
    window = list(rows)[:window_size]
    if not window:
        raise ValueError("Cannot calculate a baseline without signal rows.")
    fields = ("meetups", "calls", "avg_call_duration_min", "texts_per_week")
    return {
        "window_months": [window[0]["month"], window[-1]["month"]],
        **{f"{field}_baseline": round(fmean(row[field] for row in window), 3) for field in fields},
    }


def z_score(value: float, history: Iterable[float], variability_floor: float = 0.60) -> float:
    """Normalize a signal using only its own preceding baseline history.

    The scale floor models ordinary month-to-month variance, so the intentionally
    small seeded jitter cannot make an otherwise trivial change look enormous.
    """
    samples = list(history)
    mean = fmean(samples)
    scale = max(pstdev(samples), abs(mean) * variability_floor, 1e-9)
    return (value - mean) / scale


def sustained_threshold_month(
    scores: Iterable[dict[str, Any]], threshold: float, direction: str, months: int = 2
) -> tuple[int | None, list[int] | None]:
    """Return the month where a directional threshold has held long enough."""
    run: list[int] = []
    for score in scores:
        value = score["combined_weighted_z"]
        crossed = value < threshold if direction == "below" else value > threshold
        run = run + [score["month"]] if crossed else []
        if len(run) >= months:
            return score["month"], run[-months:]
    return None, None


def _primary_signal(score: dict[str, Any], direction: str) -> str:
    components = {
        "meetups": WEIGHTS["meetups"] * score["z_meetups"],
        "calls": WEIGHTS["calls"] * score["z_calls"],
        "texts": WEIGHTS["texts_per_week"] * score["z_texts"],
    }
    return min(components, key=components.get) if direction == "below" else max(components, key=components.get)


def _cold_start_result(contact: dict[str, Any]) -> dict[str, Any]:
    rows = contact["monthly_signals"]
    first = contact["first_appearance_month"]
    watch_end = first + 2  # Three monthly observations approximate the 8-week end point.
    window = [row for row in rows if row["month"] <= watch_end]
    latest = next((row for row in reversed(window) if row["month"] == watch_end), None)
    previous = next((row for row in reversed(window) if row["month"] < watch_end), None)
    frequency = 0.0
    if latest:
        frequency = sum(WEIGHTS[field] * latest[field] / REFERENCE_LEVELS[field] for field in WEIGHTS)
    climbing = bool(latest and previous and sum(latest[field] for field in WEIGHTS) > sum(previous[field] for field in WEIGHTS))
    fired = bool(latest and frequency >= 0.70 and climbing)
    return {
        "contact_id": contact["contact_id"],
        "baseline": {
            "window_months": [], "meetups_baseline": None, "calls_baseline": None,
            "avg_call_duration_baseline": None, "texts_per_week_baseline": None,
        },
        "monthly_scores": [],
        "flag": {
            "type": "rise_cold_start" if fired else "none", "fired": fired,
            "month_fired": watch_end if fired else None,
            "trigger_signal": "combined_weighted_frequency" if fired else None,
            "window_used": [first, watch_end] if fired else None,
        },
    }


def detect_contact(contact: dict[str, Any], baseline_window: int = 4) -> dict[str, Any]:
    """Produce the blueprint detection-output schema for one contact."""
    if contact["first_appearance_month"] > 1:
        return _cold_start_result(contact)

    rows = contact["monthly_signals"]
    if len(rows) < baseline_window:
        raise ValueError("An established contact needs four months of signal history.")
    baseline = calculate_baseline(rows, baseline_window)
    scores: list[dict[str, Any]] = []
    # "Trailing baseline" is causal: score each month against preceding history,
    # capped at the initial four months so later decline never redefines normal.
    for index in range(2, len(rows)):
        row = rows[index]
        history = rows[: min(index, baseline_window)]
        z_meetups = z_score(row["meetups"], (item["meetups"] for item in history))
        z_calls = z_score(row["calls"], (item["calls"] for item in history))
        z_texts = z_score(row["texts_per_week"], (item["texts_per_week"] for item in history))
        combined = WEIGHTS["meetups"] * z_meetups + WEIGHTS["calls"] * z_calls + WEIGHTS["texts_per_week"] * z_texts
        scores.append({
            "month": row["month"], "z_meetups": round(z_meetups, 3), "z_calls": round(z_calls, 3),
            "z_texts": round(z_texts, 3), "combined_weighted_z": round(combined, 3),
        })

    decay_month, decay_window = sustained_threshold_month(scores, -1.0, "below")
    rise_month, rise_window = sustained_threshold_month(scores, 1.0, "above")
    if decay_month is not None:
        selected, flag_type, direction, window = next(s for s in scores if s["month"] == decay_month), "decay", "below", decay_window
    elif rise_month is not None:
        selected, flag_type, direction, window = next(s for s in scores if s["month"] == rise_month), "rise_existing", "above", rise_window
    else:
        selected, flag_type, direction, window = None, "none", "below", None
    return {
        "contact_id": contact["contact_id"], "baseline": baseline, "monthly_scores": scores,
        "flag": {
            "type": flag_type, "fired": selected is not None,
            "month_fired": selected["month"] if selected else None,
            "trigger_signal": _primary_signal(selected, direction) if selected else None,
            "window_used": window,
        },
    }


def detect_dataset(dataset: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    return [detect_contact(contact) for contact in dataset["contacts"]]
