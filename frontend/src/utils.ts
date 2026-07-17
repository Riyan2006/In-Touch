import type { Contact, Signal } from "./types";

export type Tone = "warm" | "cool" | "neutral";
export type SignalKey = "texts" | "calls" | "meetups";
export const signalField: Record<SignalKey, keyof Signal> = { texts: "texts_per_week", calls: "calls", meetups: "meetups" };
export function isTextsOnly(contact: Contact) { return contact.data_source === "whatsapp"; }

export function toneFor(contact: Contact): Tone { return contact.detection.flag.type === "decay" ? "warm" : contact.detection.flag.type === "none" ? "neutral" : "cool"; }
export function statusFor(contact: Contact) {
  if (contact.detection.flag.type === "decay") return contact.archetype === "already_faded" ? "faded" : "fading";
  if (contact.detection.flag.type === "rise_cold_start") return "new & forming fast";
  if (contact.detection.flag.type === "rise_existing") return "forming";
  return contact.archetype === "drifting_early" ? "early signal" : "steady";
}
export function rowFor(contact: Contact, month: number): Signal { return contact.monthly_signals.find((row) => row.month === month) ?? { month, meetups: 0, calls: 0, avg_call_duration_min: 0, texts_per_week: 0 }; }
export function baselineFor(contact: Contact, signal: SignalKey) {
  const baseline = contact.detection.baseline;
  const value = signal === "texts" ? baseline.texts_per_week_baseline : baseline[`${signal}_baseline` as "calls_baseline" | "meetups_baseline"];
  return value ?? rowFor(contact, contact.monthly_signals[0]?.month ?? 1)[signalField[signal]];
}
export function deltaFor(contact: Contact, signal: SignalKey, month: number) {
  const value = rowFor(contact, month)[signalField[signal]]; const baseline = Math.max(Number(baselineFor(contact, signal)), .1);
  // Preserve each signal's real relative growth in the UI. The +300% cap is
  // for LLM-facing insight input; applying it here made distinct cold-start
  // signals appear identical on the three stat cards.
  return Math.round((value - baseline) / baseline * 100);
}
export function chartValues(contact: Contact) {
  const length = contact.monthly_signals.length;
  if (contact.detection.monthly_scores.length) {
    const scores = new Map(contact.detection.monthly_scores.map((score) => [score.month, score.combined_weighted_z]));
    return Array.from({ length }, (_, index) => scores.get(index + 1) ?? 0);
  }
  const first = contact.monthly_signals[0];
  return Array.from({ length }, (_, index) => {
    const row = rowFor(contact, index + 1); if (!row.meetups && !row.calls && !row.texts_per_week) return 0;
    return .4 * (row.meetups / Math.max(first.meetups, .1) - 1) + .4 * (row.calls / Math.max(first.calls, .1) - 1) + .2 * (row.texts_per_week / Math.max(first.texts_per_week, .1) - 1);
  });
}
