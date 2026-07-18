import { registerPlugin } from "@capacitor/core";
import type { Baseline, Contact, Flag, Score, Signal } from "./types";

const VARIABILITY_FLOOR = .6;

export type CalendarMonth = { month: number; label: string; meetup_count: number };
export type CalendarScan = { months: CalendarMonth[]; match_count: number };
type CalendarMeetupsPlugin = { scan(options: { displayName: string; email?: string; includeTitleMatches: boolean }): Promise<CalendarScan> };
const CalendarMeetups = registerPlugin<CalendarMeetupsPlugin>("CalendarMeetups");

function mean(values: number[]) { return values.reduce((total, value) => total + value, 0) / values.length; }
function stdev(values: number[]) { const average = mean(values); return Math.sqrt(mean(values.map((value) => (value - average) ** 2))); }
function zScore(value: number, history: number[]) { const average = mean(history); return (value - average) / Math.max(stdev(history), Math.abs(average) * VARIABILITY_FLOOR, 1e-9); }

export async function scanCalendarMeetups(displayName: string, email: string, includeTitleMatches: boolean) {
  return CalendarMeetups.scan({ displayName, email: email.trim() || undefined, includeTitleMatches });
}

export function detectCalendarOnly(months: CalendarMonth[]) {
  const monthly_signals: Signal[] = months.map((entry) => ({ month: entry.month, meetups: entry.meetup_count, calls: 0, avg_call_duration_min: 0, texts_per_week: 0 }));
  const initial = monthly_signals.slice(0, 4);
  const baseline: Baseline = { window_months: [1, 4], meetups_baseline: Number(mean(initial.map((row) => row.meetups)).toFixed(3)), calls_baseline: null, avg_call_duration_min_baseline: null, texts_per_week_baseline: null };
  const monthly_scores: Score[] = monthly_signals.slice(2).map((row, offset) => {
    const index = offset + 2;
    const history = monthly_signals.slice(0, Math.min(index, 4)).map((item) => item.meetups);
    const z = Number(zScore(row.meetups, history).toFixed(3));
    return { month: row.month, z_meetups: z, z_calls: 0, z_texts: 0, combined_weighted_z: z };
  });
  let flag: Flag = { type: "none", fired: false, month_fired: null, trigger_signal: null, window_used: null };
  for (const [direction, threshold, type] of [["below", -1, "decay"], ["above", 1, "rise_existing"]] as const) {
    let run: number[] = [];
    for (const score of monthly_scores) {
      const crossed = direction === "below" ? score.combined_weighted_z < threshold : score.combined_weighted_z > threshold;
      run = crossed ? [...run, score.month] : [];
      if (run.length >= 2) { flag = { type, fired: true, month_fired: score.month, trigger_signal: "meetups", window_used: run.slice(-2) }; break; }
    }
    if (flag.fired) break;
  }
  return { monthly_signals, baseline, monthly_scores, flag };
}

export function contactFromCalendar(name: string, email: string, months: CalendarMonth[]): Contact {
  const detection = detectCalendarOnly(months);
  const latest = months.at(-1)!;
  const flag = detection.flag;
  const insight = !flag.fired || !flag.month_fired ? null : flag.type === "decay"
    ? `Calendar time with ${name} has become quieter since ${months[flag.month_fired - 1].label}.`
    : `Calendar time with ${name} has become more regular since ${months[flag.month_fired - 1].label}.`;
  return { contact_id: `calendar-${Date.now()}`, name, archetype: "calendar_import", monthly_signals: detection.monthly_signals, detection: { baseline: detection.baseline, monthly_scores: detection.monthly_scores, flag }, insight, data_source: "calendar", source_email: email.trim() || undefined, source_data: { calendar: months.map((entry) => ({ label: entry.label, meetup_count: entry.meetup_count })) }, month_labels: months.map((entry) => entry.label) };
}
