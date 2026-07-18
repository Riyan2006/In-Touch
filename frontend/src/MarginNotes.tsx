import { animate, motion, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Contact } from "./types";
import { deltaFor, isCalendarOnly, isCombinedSources, isTextsOnly, rowFor, signalField, type SignalKey } from "./utils";

const signals: { key: SignalKey; label: string; icon: string; unit: string }[] = [
  { key: "texts", label: "Texts", icon: "◌", unit: "/wk" },
  { key: "calls", label: "Calls", icon: "⌁", unit: "/mo" },
  { key: "meetups", label: "Meetups", icon: "○", unit: "/mo" },
];

function Count({ value }: { value: number }) {
  const reduced = useReducedMotion(); const motionValue = useMotionValue(value); const [shown, setShown] = useState(value);
  useEffect(() => { if (reduced) { setShown(value); return; } const controls = animate(motionValue, value, { duration: .42, ease: "easeOut" }); return controls.stop; }, [value, reduced, motionValue]);
  useEffect(() => motionValue.on("change", (next) => setShown(Math.round(next * 10) / 10)), [motionValue]);
  return <>{shown.toFixed(1)}</>;
}

function Delta({ value }: { value: number }) {
  const capped = Math.abs(value) > 999; const label = capped ? "999.0%+" : `${Math.abs(value).toFixed(1)}%`;
  return <span className={value > 0 ? "delta up" : value < 0 ? "delta down" : "delta flat"}>{value > 0 ? "↗" : value < 0 ? "↘" : "—"} {label}</span>;
}

export default function MarginNotes({ contact, month }: { contact: Contact; month: number }) {
  const row = rowFor(contact, month); const textsOnly = isTextsOnly(contact); const calendarOnly = isCalendarOnly(contact); const combined = isCombinedSources(contact); const singleSource = textsOnly || calendarOnly; const available = textsOnly ? signals.filter((signal) => signal.key === "texts") : calendarOnly ? signals.filter((signal) => signal.key === "meetups") : combined ? signals.filter((signal) => signal.key !== "calls") : signals;
  return <><div className={`signal-cards ${singleSource ? "texts-only-cards" : ""}`}>{available.map((signal) => {
    const value = row[signalField[signal.key]] as number;
    return <motion.article className="signal-card" key={signal.key} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .24 }}><div className="signal-top">{!singleSource && <span className="signal-icon" aria-hidden>{signal.icon}</span>}<Delta value={deltaFor(contact, signal.key, month)}/></div><p className="signal-value"><Count value={value}/><small>{signal.unit}</small></p><p className="signal-label">{signal.label}</p></motion.article>;
  })}</div>{textsOnly && <p className="texts-only-note">Texts only · calls and meetups are not available from a chat export.</p>}{calendarOnly && <p className="texts-only-note">Calendar meetups only · calls and texts are not available from this connection.</p>}{combined && <p className="texts-only-note">Texts + calendar meetups · calls are not available from these connected sources.</p>}</>;
}
