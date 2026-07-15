"""Run the deterministic six-contact validation summary."""

from .detection import detect_dataset
from .generator import generate_dataset


def main() -> None:
    dataset = generate_dataset()
    results = {result["contact_id"]: result for result in detect_dataset(dataset)}
    print("contact_id  archetype       flag.type         month_fired")
    for contact in dataset["contacts"]:
        flag = results[contact["contact_id"]]["flag"]
        print(f'{contact["contact_id"]:<11} {contact["archetype"]:<15} {flag["type"]:<17} {flag["month_fired"] or "never fired"}')


if __name__ == "__main__":
    main()
