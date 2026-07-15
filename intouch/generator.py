"""Seeded, configurable synthetic relationship-signal data."""

from __future__ import annotations

from dataclasses import dataclass
from random import Random
from typing import Any, Iterable


SignalValues = tuple[float, float, float, float]


@dataclass(frozen=True)
class GeneratorConfig:
    """Tuning knobs for the demo curves; defaults reproduce the blueprint."""

    seed: int = 42
    jitter_min: float = 0.15
    jitter_max: float = 0.20
    months: int = 12
    lead_meetup_drop_month: int = 5
    lead_call_drop_month: int = 7
    lead_text_drop_month: int = 9
    warming_start_month: int = 7
    cold_start_first_month: int = 6

    def __post_init__(self) -> None:
        if self.months != 12:
            raise ValueError("The MVP dataset is intentionally a 12-month simulation.")
        if not 0 <= self.jitter_min <= self.jitter_max:
            raise ValueError("Jitter bounds must satisfy 0 <= min <= max.")


def _apply_jitter(values: SignalValues, rng: Random, config: GeneratorConfig) -> dict[str, float]:
    keys = ("meetups", "calls", "avg_call_duration_min", "texts_per_week")
    result: dict[str, float] = {}
    for key, value in zip(keys, values):
        if value == 0:
            result[key] = 0.0
            continue
        direction = -1 if rng.random() < 0.5 else 1
        fraction = rng.uniform(config.jitter_min, config.jitter_max)
        result[key] = round(max(0.0, value * (1 + direction * fraction)), 3)
    return result


def _rows(
    values: Iterable[SignalValues], rng: Random, config: GeneratorConfig, start_month: int = 1
) -> list[dict[str, float | int]]:
    return [
        {"month": month, **_apply_jitter(value, rng, config)}
        for month, value in enumerate(values, start=start_month)
    ]


def _lead_curve(config: GeneratorConfig) -> list[SignalValues]:
    """Blueprint table; timing guards make the three transitions tunable."""
    baseline = (2.0, 4.0, 20.0, 20.0)
    curve: list[SignalValues] = []
    for month in range(1, 13):
        if month < config.lead_meetup_drop_month:
            meetups = 2.0
        elif month == config.lead_meetup_drop_month:
            meetups = 1.0
        elif month == config.lead_meetup_drop_month + 1:
            meetups = 0.3
        elif month < 11:
            meetups = 0.2 if month < 9 else 0.1
        else:
            meetups = 0.0

        calls, duration = (4.0, 20.0)
        if month == config.lead_call_drop_month:
            calls, duration = (2.0, 14.0)
        elif month == config.lead_call_drop_month + 1:
            calls, duration = (1.0, 9.0)
        elif month >= config.lead_call_drop_month + 2:
            calls, duration = ((1.0, 8.0) if month in (9, 12) else (0.8, 8.0 if month == 10 else 7.0))

        texts = 20.0 if month < config.lead_text_drop_month else {9: 17.0, 10: 14.0, 11: 11.0, 12: 10.0}[month]
        curve.append((meetups, calls, duration, texts))
    return curve


def _linear_curve(start: SignalValues, end: SignalValues, start_month: int) -> list[SignalValues]:
    curve: list[SignalValues] = []
    for month in range(1, 13):
        if month < start_month:
            curve.append(start)
            continue
        progress = (month - start_month + 1) / (13 - start_month)
        curve.append(tuple(round(a + (b - a) * progress, 3) for a, b in zip(start, end)))  # type: ignore[arg-type]
    return curve


def generate_dataset(config: GeneratorConfig | None = None) -> dict[str, list[dict[str, Any]]]:
    """Return the raw-dataset schema with all six blueprint archetypes."""
    config = config or GeneratorConfig()
    rng = Random(config.seed)
    stable = [(2.0, 4.0, 20.0, 20.0)] * 12
    already_faded = [(2.5, 5.0, 22.0, 24.0)] * 2 + [(0.3, 0.5, 5.0, 3.0)] * 10
    drifting = [(2.0, 4.0, 20.0, 20.0)] * 9 + [
        (1.8, 3.7, 19.0, 19.0), (1.6, 3.4, 18.0, 18.0), (1.4, 3.1, 17.0, 17.0)
    ]
    warming = _linear_curve((0.5, 1.0, 10.0, 5.0), (1.5, 3.0, 15.0, 15.0), config.warming_start_month)
    cold_start = [(0.3, 0.5, 7.0, 3.0), (1.1, 2.2, 12.0, 11.0), (1.9, 3.8, 16.0, 19.0), (2.0, 3.9, 17.0, 20.0), (2.0, 4.0, 18.0, 20.0), (2.1, 4.0, 18.0, 20.0), (2.1, 4.0, 18.0, 20.0)]

    contacts = [
        ("c1", "Priya", "fading_lead", 1, _lead_curve(config)),
        ("c2", "Meher", "stable", 1, stable),
        ("c3", "Tanvi", "already_faded", 1, already_faded),
        ("c4", "Rohan", "drifting_early", 1, drifting),
        ("c5", "Kabir", "warming_up", 1, warming),
        ("c6", "Ishaan", "cold_start_new", config.cold_start_first_month, cold_start),
    ]
    return {
        "contacts": [
            {
                "contact_id": contact_id,
                "name": name,
                "archetype": archetype,
                "first_appearance_month": first_month,
                "monthly_signals": _rows(curve, rng, config, first_month),
            }
            for contact_id, name, archetype, first_month, curve in contacts
        ]
    }
