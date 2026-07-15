import unittest

from intouch.detection import calculate_baseline, detect_contact, detect_dataset, sustained_threshold_month, z_score
from intouch.generator import GeneratorConfig, generate_dataset


class DetectionTests(unittest.TestCase):
    def test_baseline_uses_first_four_available_months(self):
        rows = [
            {"month": month, "meetups": float(month), "calls": 2.0, "avg_call_duration_min": 10.0, "texts_per_week": 5.0}
            for month in range(1, 6)
        ]
        baseline = calculate_baseline(rows)
        self.assertEqual([1, 4], baseline["window_months"])
        self.assertEqual(2.5, baseline["meetups_baseline"])

    def test_z_score_normalizes_against_its_own_history(self):
        self.assertAlmostEqual(-1 / 3, z_score(8.0, [10.0, 10.0]), places=6)

    def test_sustained_decay_and_rise_need_two_consecutive_months(self):
        decay = [{"month": 5, "combined_weighted_z": -1.2}, {"month": 6, "combined_weighted_z": -1.1}]
        rise = [{"month": 5, "combined_weighted_z": 1.3}, {"month": 6, "combined_weighted_z": 1.2}]
        self.assertEqual((6, [5, 6]), sustained_threshold_month(decay, -1.0, "below"))
        self.assertEqual((6, [5, 6]), sustained_threshold_month(rise, 1.0, "above"))

    def test_cold_start_reaches_reference_and_is_still_climbing(self):
        dataset = generate_dataset(GeneratorConfig(jitter_min=0, jitter_max=0))
        cold_start = dataset["contacts"][-1]
        flag = detect_contact(cold_start)["flag"]
        self.assertEqual("rise_cold_start", flag["type"])
        self.assertEqual(8, flag["month_fired"])

    def test_default_seed_meets_all_six_expected_outcomes(self):
        dataset = generate_dataset()
        outcomes = {result["contact_id"]: result["flag"] for result in detect_dataset(dataset)}
        self.assertEqual(("decay", 9), (outcomes["c1"]["type"], outcomes["c1"]["month_fired"]))
        self.assertEqual("none", outcomes["c2"]["type"])
        self.assertEqual(("decay", 4), (outcomes["c3"]["type"], outcomes["c3"]["month_fired"]))
        self.assertEqual("none", outcomes["c4"]["type"])
        self.assertIn(outcomes["c5"]["month_fired"], (9, 10))
        self.assertEqual("rise_existing", outcomes["c5"]["type"])
        self.assertEqual(("rise_cold_start", 8), (outcomes["c6"]["type"], outcomes["c6"]["month_fired"]))


if __name__ == "__main__":
    unittest.main()
