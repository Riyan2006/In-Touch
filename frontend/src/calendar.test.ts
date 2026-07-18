import { describe, expect, it } from "vitest";
import { detectCalendarOnly } from "./calendar";
import { combineContact } from "./combined";
import type { Contact } from "./types";

const months = (counts: number[]) => counts.map((meetup_count, index) => ({ month: index + 1, label: `M${index + 1}`, meetup_count }));
describe("calendar-only detection", () => {
  it("keeps a steady calendar unflagged", () => expect(detectCalendarOnly(months([2, 2, 2, 2, 2, 2])).flag.type).toBe("none"));
  it("flags a sustained decline in scheduled meetups", () => { const result = detectCalendarOnly(months([4, 4, 4, 4, 1, 1])); expect(result.flag).toMatchObject({ type: "decay", month_fired: 6, trigger_signal: "meetups" }); });
  it("flags a sustained rise in scheduled meetups", () => { const result = detectCalendarOnly(months([1, 1, 1, 1, 4, 4])); expect(result.flag).toMatchObject({ type: "rise_existing", month_fired: 6, trigger_signal: "meetups" }); });
  it("combines matching WhatsApp and calendar months using their relative 1:2 signal weights", () => {
    const base = { name: "Ari", archetype: "test", insight: null, detection: { baseline: { window_months: [1, 4], meetups_baseline: null, calls_baseline: null, avg_call_duration_min_baseline: null, texts_per_week_baseline: null }, monthly_scores: [], flag: { type: "none" as const, fired: false, month_fired: null, trigger_signal: null, window_used: null } } };
    const whatsapp = { ...base, contact_id: "w", data_source: "whatsapp" as const, monthly_signals: months([0, 0, 0, 0, 0, 0]).map((row) => ({ month: row.month, meetups: 0, calls: 0, avg_call_duration_min: 0, texts_per_week: row.meetup_count })), month_labels: months([0, 0, 0, 0, 0, 0]).map((row) => `Jan 2025`.replace("Jan", ["Jan", "Feb", "Mar", "Apr", "May", "Jun"][row.month - 1])), source_data: { whatsapp: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, index) => ({ label: `${month} 2025`, texts_per_week: index < 4 ? 1 : 5 })) } } as Contact;
    const calendar = { ...base, contact_id: "c", data_source: "calendar" as const, monthly_signals: [], month_labels: [], source_data: { calendar: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((month, index) => ({ label: `${month} 2025`, meetup_count: index < 4 ? 1 : 5 })) } } as Contact;
    const combined = combineContact(whatsapp, calendar, "Ari", "person-ari");
    expect(combined.data_source).toBe("combined"); expect(combined.monthly_signals).toHaveLength(6); expect(combined.monthly_signals[4]).toMatchObject({ texts_per_week: 5, meetups: 5 }); expect(combined.detection.flag).toMatchObject({ type: "rise_existing", month_fired: 6 });
  });
});
