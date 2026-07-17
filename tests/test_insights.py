import os
import unittest
from unittest.mock import patch

from intouch.detection import detect_dataset
from intouch.generator import generate_dataset
from intouch.insights import MODEL_FALLBACK_CHAIN, build_insight_input, generate_insight, validate_insight


class InsightTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.dataset = generate_dataset()
        cls.contacts = {contact["contact_id"]: contact for contact in cls.dataset["contacts"]}
        cls.results = {result["contact_id"]: result for result in detect_dataset(cls.dataset)}

    def test_builds_expected_decay_input_for_c1(self):
        payload = build_insight_input(self.contacts["c1"], self.results["c1"])
        self.assertEqual("Priya", payload["contact_name"])
        self.assertEqual("decay", payload["flag_type"])
        self.assertEqual("meetups", payload["primary_signal"])
        self.assertEqual(-94, payload["primary_signal_change_pct"])
        self.assertEqual("calls", payload["secondary_signal"])
        self.assertEqual(-77, payload["secondary_signal_change_pct"])
        self.assertEqual("texts", payload["stable_signal"])
        self.assertEqual(-37, payload["stable_signal_change_pct"])
        self.assertEqual(1, payload["months_since_change_started"])
        self.assertEqual(9, payload["month_flag_fired"])

    def test_builds_expected_cold_start_input_for_c6(self):
        payload = build_insight_input(self.contacts["c6"], self.results["c6"])
        self.assertEqual("Ishaan", payload["contact_name"])
        self.assertEqual("rise_cold_start", payload["flag_type"])
        self.assertEqual("texts", payload["primary_signal"])
        self.assertEqual(300, payload["primary_signal_change_pct"])
        self.assertEqual("calls", payload["secondary_signal"])
        self.assertEqual(300, payload["secondary_signal_change_pct"])
        self.assertEqual("meetups", payload["stable_signal"])
        self.assertEqual(300, payload["stable_signal_change_pct"])
        self.assertEqual(2, payload["months_since_change_started"])
        self.assertEqual(8, payload["month_flag_fired"])

    def test_validates_safe_single_sentences(self):
        self.assertTrue(validate_insight("Calls with Kabir have become more frequent since month 8."))
        self.assertTrue(validate_insight("Meetups with Priya have been quieter since month 5."))

    def test_rejects_advice_scores_and_multiple_sentences(self):
        self.assertFalse(validate_insight("You should reach out to Priya."))
        self.assertFalse(validate_insight("Your closeness score with Priya changed."))
        self.assertFalse(validate_insight("Calls changed. Texts held steady."))
        self.assertFalse(validate_insight("Rule"))
        self.assertFalse(validate_insight("Your meetups with"))

    def test_uses_next_model_after_temporary_capacity_failure(self):
        payload = build_insight_input(self.contacts["c1"], self.results["c1"])
        calls: list[str] = []

        def call_with_first_model_unavailable(_payload, _instruction, model_name):
            calls.append(model_name)
            if model_name == MODEL_FALLBACK_CHAIN[0]:
                raise RuntimeError("503 UNAVAILABLE: high demand")
            return "Meetups with Priya have been quieter since month 5."

        with patch("intouch.insights._call_gemini", side_effect=call_with_first_model_unavailable):
            sentence = generate_insight(payload)

        self.assertTrue(validate_insight(sentence))
        self.assertEqual([MODEL_FALLBACK_CHAIN[0], MODEL_FALLBACK_CHAIN[1]], calls)

    @unittest.skipUnless(os.getenv("RUN_GEMINI_INTEGRATION") == "1" and os.getenv("GEMINI_API_KEY"), "set RUN_GEMINI_INTEGRATION=1 and GEMINI_API_KEY to call Gemini")
    def test_gemini_c1_output_passes_validation(self):
        payload = build_insight_input(self.contacts["c1"], self.results["c1"])
        self.assertTrue(validate_insight(generate_insight(payload)))


if __name__ == "__main__":
    unittest.main()
