"""Export the deterministic demo payload consumed by the static React UI."""

from __future__ import annotations

import json
from pathlib import Path

from .detection import detect_dataset
from .generator import generate_dataset
from .insights import generate_all_insights


def export_demo_data(output_path: Path | None = None) -> Path:
    """Run the full pipeline once and write the frontend's consolidated JSON."""
    dataset = generate_dataset()
    detections = detect_dataset(dataset)
    insights = generate_all_insights(dataset, detections)
    by_contact_id = {result["contact_id"]: result for result in detections}
    payload = {
        "contacts": [
            {
                "contact_id": contact["contact_id"],
                "name": contact["name"],
                "archetype": contact["archetype"],
                "monthly_signals": contact["monthly_signals"],
                "detection": by_contact_id[contact["contact_id"]],
                "insight": insights[contact["contact_id"]],
            }
            for contact in dataset["contacts"]
        ]
    }
    destination = output_path or Path(__file__).parents[1] / "frontend" / "src" / "data" / "demo-data.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return destination


if __name__ == "__main__":
    print(export_demo_data())
