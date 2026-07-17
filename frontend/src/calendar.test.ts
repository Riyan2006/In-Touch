import { describe, expect, it } from "vitest";
import { detectCalendarOnly } from "./calendar";

const months = (counts: number[]) => counts.map((meetup_count, index) => ({ month: index + 1, label: `M${index + 1}`, meetup_count }));
describe("calendar-only detection", () => {
  it("keeps a steady calendar unflagged", () => expect(detectCalendarOnly(months([2, 2, 2, 2, 2, 2])).flag.type).toBe("none"));
  it("flags a sustained decline in scheduled meetups", () => { const result = detectCalendarOnly(months([4, 4, 4, 4, 1, 1])); expect(result.flag).toMatchObject({ type: "decay", month_fired: 6, trigger_signal: "meetups" }); });
  it("flags a sustained rise in scheduled meetups", () => { const result = detectCalendarOnly(months([1, 1, 1, 1, 4, 4])); expect(result.flag).toMatchObject({ type: "rise_existing", month_fired: 6, trigger_signal: "meetups" }); });
});
