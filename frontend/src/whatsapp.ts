import type { Baseline, Contact, Flag, Score, Signal } from "./types";

const WEEKS_PER_MONTH = 4.33;
const VARIABILITY_FLOOR = .60;
const ANDROID_LINE = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*\d{1,2}:\d{2}(?::\d{2})?\s+-\s+[^:]+:\s*(.*)$/;
const IOS_LINE = /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),\s*\d{1,2}:\d{2}:\d{2}\]\s+[^:]+:\s*(.*)$/;
const EXCLUDED_BODIES = [
  /^<media omitted>$/i,
  /^(this message was deleted|you deleted this message)$/i,
  /^messages and calls are end-to-end encrypted/i,
];

export type ChatMonth = { month: number; label: string; message_count: number; texts_per_week: number };
export type ParseFailure = "unrecognized_format" | "no_messages" | "under_four_months";
export type ParseResult = { months: ChatMonth[] } | { error: ParseFailure };

function dateFromParts(day: string, month: string, year: string) {
  const normalizedYear = year.length === 2 ? 2000 + Number(year) : Number(year);
  return new Date(normalizedYear, Number(month) - 1, Number(day));
}

function isExcludedBody(body: string) { return EXCLUDED_BODIES.some((pattern) => pattern.test(body.trim())); }

function monthKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }

function monthLabel(date: Date) { return date.toLocaleString("en", { month: "short", year: "numeric" }); }

function calendarMonths(first: Date, last: Date, counts: Map<string, number>) {
  const months: ChatMonth[] = [];
  const cursor = new Date(first.getFullYear(), first.getMonth(), 1);
  const end = new Date(last.getFullYear(), last.getMonth(), 1);
  while (cursor <= end) {
    const date = new Date(cursor);
    months.push({ month: months.length + 1, label: monthLabel(date), message_count: counts.get(monthKey(date)) ?? 0, texts_per_week: Number(((counts.get(monthKey(date)) ?? 0) / WEEKS_PER_MONTH).toFixed(3)) });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months.slice(-12).map((entry, index) => ({ ...entry, month: index + 1 }));
}

/** Parses timestamps and discards message bodies immediately after exclusion checks. */
export function parseWhatsAppExport(text: string): ParseResult {
  const counts = new Map<string, number>();
  let recognizedTimestamp = false;
  let countedMessage = false;
  let firstDate: Date | undefined;
  let lastDate: Date | undefined;

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(ANDROID_LINE) ?? line.match(IOS_LINE);
    if (!match) continue; // Continuation lines belong to the preceding message and are never new messages.
    recognizedTimestamp = true;
    const date = dateFromParts(match[1], match[2], match[3]);
    const body = match[4];
    if (isExcludedBody(body)) continue;
    // body is intentionally not placed in a collection, returned value, log, or state.
    const key = monthKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    countedMessage = true;
    if (!firstDate || date < firstDate) firstDate = date;
    if (!lastDate || date > lastDate) lastDate = date;
  }

  if (!recognizedTimestamp) return { error: "unrecognized_format" };
  if (!countedMessage || !firstDate || !lastDate) return { error: "no_messages" };
  const months = calendarMonths(firstDate, lastDate, counts);
  return months.length < 4 ? { error: "under_four_months" } : { months };
}

function mean(values: number[]) { return values.reduce((total, value) => total + value, 0) / values.length; }

function populationStdev(values: number[]) { const average = mean(values); return Math.sqrt(mean(values.map((value) => (value - average) ** 2))); }

export function textsOnlyZScore(value: number, history: number[]) {
  const average = mean(history);
  const scale = Math.max(populationStdev(history), Math.abs(average) * VARIABILITY_FLOOR, 1e-9);
  return (value - average) / scale;
}

export function sustainedTextsFlag(scores: Score[]): Flag {
  for (const [direction, threshold, type] of [["below", -1, "decay"], ["above", 1, "rise_existing"]] as const) {
    let run: number[] = [];
    for (const score of scores) {
      const crossed = direction === "below" ? score.combined_weighted_z < threshold : score.combined_weighted_z > threshold;
      run = crossed ? [...run, score.month] : [];
      if (run.length >= 2) return { type, fired: true, month_fired: score.month, trigger_signal: "texts", window_used: run.slice(-2) };
    }
  }
  return { type: "none", fired: false, month_fired: null, trigger_signal: null, window_used: null };
}

export function detectTextsOnly(months: ChatMonth[]) {
  const signals: Signal[] = months.map((entry) => ({ month: entry.month, meetups: 0, calls: 0, avg_call_duration_min: 0, texts_per_week: entry.texts_per_week }));
  const initial = signals.slice(0, 4);
  const baseline: Baseline = {
    window_months: [signals[0].month, signals[3].month],
    meetups_baseline: null,
    calls_baseline: null,
    avg_call_duration_min_baseline: null,
    texts_per_week_baseline: Number(mean(initial.map((row) => row.texts_per_week)).toFixed(3)),
  };
  const monthly_scores: Score[] = signals.slice(2).map((row, offset) => {
    const index = offset + 2;
    const history = signals.slice(0, Math.min(index, 4)).map((item) => item.texts_per_week);
    const z = textsOnlyZScore(row.texts_per_week, history);
    return { month: row.month, z_meetups: 0, z_calls: 0, z_texts: Number(z.toFixed(3)), combined_weighted_z: Number(z.toFixed(3)) };
  });
  return { monthly_signals: signals, baseline, monthly_scores, flag: sustainedTextsFlag(monthly_scores) };
}

export function fallbackInsight(name: string, flag: Flag, textsPerWeek: number, baseline: Baseline, label: string) {
  if (!flag.fired || !flag.month_fired || baseline.texts_per_week_baseline === null) return null;
  const change = Math.round((textsPerWeek - baseline.texts_per_week_baseline) / Math.max(baseline.texts_per_week_baseline, .1) * 100);
  return `Texts with ${name} have been ${Math.abs(change)}% ${change < 0 ? "less" : "more"} by ${label}.`;
}

export function contactFromWhatsApp(name: string, months: ChatMonth[]): Contact {
  const detection = detectTextsOnly(months);
  const latest = months.at(-1)!;
  return {
    contact_id: `whatsapp-${Date.now()}`,
    name,
    archetype: "whatsapp_export",
    monthly_signals: detection.monthly_signals,
    detection: { baseline: detection.baseline, monthly_scores: detection.monthly_scores, flag: detection.flag },
    insight: fallbackInsight(name, detection.flag, latest.texts_per_week, detection.baseline, latest.label),
    data_source: "whatsapp",
    source_data: { whatsapp: months.map((entry) => ({ label: entry.label, texts_per_week: entry.texts_per_week })) },
    month_labels: months.map((entry) => entry.label),
  };
}
