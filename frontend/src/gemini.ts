import type { Contact } from "./types";
import { rowFor } from "./utils";

type RuntimeInsightInput = {
  contact_name: string;
  flag_type: Contact["detection"]["flag"]["type"];
  primary_signal: string;
  month_flag_fired: number | null;
  latest_value: number;
  baseline_value: number | null;
  available_signals: string[];
};

const productionEndpoint = "https://in-touch-beta.vercel.app/api/insight";

function endpoint() {
  return import.meta.env.MODE === "android"
    ? import.meta.env.VITE_GEMINI_INSIGHT_ENDPOINT || productionEndpoint
    : "/api/insight";
}

export async function generateRuntimeInsight(input: RuntimeInsightInput): Promise<string> {
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error("The insight service is unavailable.");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || typeof (payload as { sentence?: unknown }).sentence !== "string") {
    throw new Error("The insight service returned an invalid response.");
  }
  return (payload as { sentence: string }).sentence.trim();
}

export function runtimeInsightInput(contact: Contact, primarySignal: string, month: number): RuntimeInsightInput {
  const row = rowFor(contact, month);
  const field = primarySignal === "meetups" ? "meetups" : primarySignal === "calls" ? "calls" : "texts_per_week";
  const baseline = field === "meetups" ? contact.detection.baseline.meetups_baseline : field === "calls" ? contact.detection.baseline.calls_baseline : contact.detection.baseline.texts_per_week_baseline;
  const available = contact.data_source === "whatsapp" ? ["texts"] : contact.data_source === "calendar" ? ["meetups"] : contact.data_source === "combined" ? ["texts", "meetups"] : ["texts", "calls", "meetups"];
  return {
    contact_name: contact.name,
    flag_type: contact.detection.flag.type,
    primary_signal: primarySignal,
    month_flag_fired: contact.detection.flag.month_fired,
    latest_value: row[field],
    baseline_value: baseline,
    available_signals: available,
  };
}
