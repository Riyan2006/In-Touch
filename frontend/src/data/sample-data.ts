import type { DemoData } from "../types";

// This is the only relationship bundled in the Android APK. It is a
// fictional, precomputed example and does not depend on an API or network call.
const sampleData: DemoData = {
  contacts: [{
    contact_id: "sample-contact",
    name: "Sample Contact",
    archetype: "illustrative_forming",
    monthly_signals: [
      [0.6, 1.0, 10, 5.0], [0.5, 1.1, 10, 5.4], [0.5, 0.9, 9, 4.8], [0.6, 1.0, 10, 5.2],
      [0.5, 1.0, 10, 5.5], [0.6, 1.1, 11, 5.8], [0.7, 1.3, 11, 7.4], [0.8, 1.7, 13, 9.1],
      [1.0, 2.1, 14, 11.6], [1.2, 2.4, 15, 13.2], [1.3, 2.7, 16, 14.8], [1.5, 3.0, 16, 16.1],
    ].map(([meetups, calls, avg_call_duration_min, texts_per_week], index) => ({ month: index + 1, meetups, calls, avg_call_duration_min, texts_per_week })),
    detection: {
      baseline: { window_months: [1, 4], meetups_baseline: 0.55, calls_baseline: 1.0, avg_call_duration_min_baseline: 9.75, texts_per_week_baseline: 5.1 },
      monthly_scores: [
        { month: 3, z_meetups: -0.2, z_calls: -0.2, z_texts: -0.2, combined_weighted_z: -0.2 },
        { month: 4, z_meetups: 0.2, z_calls: 0.0, z_texts: 0.1, combined_weighted_z: 0.1 },
        { month: 5, z_meetups: -0.1, z_calls: 0.0, z_texts: 0.3, combined_weighted_z: 0.0 },
        { month: 6, z_meetups: 0.2, z_calls: 0.2, z_texts: 0.5, combined_weighted_z: 0.3 },
        { month: 7, z_meetups: 0.5, z_calls: 0.6, z_texts: 1.0, combined_weighted_z: 0.6 },
        { month: 8, z_meetups: 0.8, z_calls: 1.2, z_texts: 1.8, combined_weighted_z: 1.2 },
        { month: 9, z_meetups: 1.3, z_calls: 1.8, z_texts: 2.5, combined_weighted_z: 1.8 },
        { month: 10, z_meetups: 1.7, z_calls: 2.3, z_texts: 3.1, combined_weighted_z: 2.2 },
        { month: 11, z_meetups: 2.0, z_calls: 2.7, z_texts: 3.7, combined_weighted_z: 2.6 },
        { month: 12, z_meetups: 2.5, z_calls: 3.2, z_texts: 4.2, combined_weighted_z: 3.1 },
      ],
      flag: { type: "rise_existing", fired: true, month_fired: 9, trigger_signal: "texts", window_used: [8, 9] },
    },
    insight: "Texts with Sample Contact have become more regular over the last few months, with calls and meetups beginning to follow.",
  }],
};

export default sampleData;
