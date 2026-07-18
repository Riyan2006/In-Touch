import type { Baseline, Contact, Flag, Score, SourceData, SourceMonth } from "./types";

const FLOOR = .6;
const dateFor = (label: string) => new Date(`${label} 01`).getTime();
const keyFor = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const labelFor = (date: Date) => date.toLocaleString("en", { month: "short", year: "numeric" });
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const z = (value: number, values: number[]) => { const average = mean(values); const deviation = Math.sqrt(mean(values.map((entry) => (entry - average) ** 2))); return (value - average) / Math.max(deviation, Math.abs(average) * FLOOR, 1e-9); };

export function sourceDataFor(contact: Contact): SourceData {
  if (contact.source_data) return contact.source_data;
  const labels = contact.month_labels ?? contact.monthly_signals.map((row) => `Month ${row.month}`);
  if (contact.data_source === "whatsapp") return { whatsapp: contact.monthly_signals.map((row, index) => ({ label: labels[index], texts_per_week: row.texts_per_week })) };
  if (contact.data_source === "calendar") return { calendar: contact.monthly_signals.map((row, index) => ({ label: labels[index], meetup_count: row.meetups })) };
  return {};
}

export function combineContact(existing: Contact | undefined, imported: Contact, personName: string, contactId: string): Contact {
  const sources = { ...sourceDataFor(existing ?? imported), ...sourceDataFor(imported) };
  if (!sources.whatsapp || !sources.calendar) return { ...imported, contact_id: contactId, name: personName };
  const whatsapp = sources.whatsapp; const calendar = sources.calendar;
  const start = Math.max(dateFor(whatsapp[0].label), dateFor(calendar[0].label));
  const end = Math.min(dateFor(whatsapp.at(-1)!.label), dateFor(calendar.at(-1)!.label));
  const startDate = new Date(start); const endDate = new Date(end);
  const span = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + 1;
  if (span < 4) throw new Error("Need at least 4 overlapping calendar months between the WhatsApp export and calendar history.");
  const textByMonth = new Map(whatsapp.map((row) => [keyFor(new Date(`${row.label} 01`)), row.texts_per_week ?? 0]));
  const meetupsByMonth = new Map(calendar.map((row) => [keyFor(new Date(`${row.label} 01`)), row.meetup_count ?? 0]));
  const first = new Date(startDate.getFullYear(), startDate.getMonth() + Math.max(0, span - 12), 1);
  const length = Math.min(span, 12); const rows = Array.from({ length }, (_, index) => { const date = new Date(first.getFullYear(), first.getMonth() + index, 1); const key = keyFor(date); return { month: index + 1, label: labelFor(date), meetups: meetupsByMonth.get(key) ?? 0, texts_per_week: textByMonth.get(key) ?? 0 }; });
  const baselineRows = rows.slice(0, 4);
  const baseline: Baseline = { window_months: [1, 4], meetups_baseline: Number(mean(baselineRows.map((row) => row.meetups)).toFixed(3)), calls_baseline: null, avg_call_duration_min_baseline: null, texts_per_week_baseline: Number(mean(baselineRows.map((row) => row.texts_per_week)).toFixed(3)) };
  const monthly_scores: Score[] = rows.slice(2).map((row, offset) => { const index = offset + 2; const history = rows.slice(0, Math.min(index, 4)); const z_meetups = Number(z(row.meetups, history.map((entry) => entry.meetups)).toFixed(3)); const z_texts = Number(z(row.texts_per_week, history.map((entry) => entry.texts_per_week)).toFixed(3)); return { month: row.month, z_meetups, z_calls: 0, z_texts, combined_weighted_z: Number(((z_meetups * 2 + z_texts) / 3).toFixed(3)) }; });
  let flag: Flag = { type: "none", fired: false, month_fired: null, trigger_signal: null, window_used: null };
  for (const [direction, threshold, type] of [["below", -1, "decay"], ["above", 1, "rise_existing"]] as const) { let run: Score[] = []; for (const score of monthly_scores) { const crossed = direction === "below" ? score.combined_weighted_z < threshold : score.combined_weighted_z > threshold; run = crossed ? [...run, score] : []; if (run.length >= 2) { const fired = run.at(-1)!; flag = { type, fired: true, month_fired: fired.month, trigger_signal: Math.abs(fired.z_meetups * 2) >= Math.abs(fired.z_texts) ? "meetups" : "texts", window_used: run.slice(-2).map((entry) => entry.month) }; break; } } if (flag.fired) break; }
  const insight = !flag.fired || !flag.month_fired ? null : `Texts and calendar time with ${personName} have ${flag.type === "decay" ? "grown quieter" : "become more regular"} since ${rows[flag.month_fired - 1].label}.`;
  return { contact_id: contactId, name: personName, archetype: "combined_sources", monthly_signals: rows.map(({ month, meetups, texts_per_week }) => ({ month, meetups, texts_per_week, calls: 0, avg_call_duration_min: 0 })), detection: { baseline, monthly_scores, flag }, insight, data_source: "combined", source_email: imported.source_email ?? existing?.source_email, source_data: sources, month_labels: rows.map((row) => row.label) };
}
