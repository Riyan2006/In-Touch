import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useRef } from "react";
import type { PointerEvent } from "react";
import type { Contact } from "./types";
import { chartValues, toneFor } from "./utils";

type Point = { x: number; y: number }; const W = 320; const H = 130; const PX = 14; const PT = 16; const PB = 14;
function spline(points: Point[]) { return points.reduce((d, point, i) => { if (!i) return `M ${point.x} ${point.y}`; const p0 = points[i - 2] ?? points[i - 1]; const p1 = points[i - 1]; const p2 = point; const p3 = points[i + 1] ?? p2; return `${d} C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`; }, ""); }
export default function PulseLine({ contact, month, onMonth }: { contact: Contact; month: number; onMonth: (month: number) => void }) {
  const reduced = useReducedMotion(); const ref = useRef<SVGSVGElement>(null); const values = useMemo(() => chartValues(contact), [contact]); const lo = Math.min(...values) - .4; const hi = Math.max(...values) + .4;
  const points = useMemo(() => values.map((value, index) => ({ x: PX + index / 11 * (W - PX * 2), y: PT + (1 - (value - lo) / (hi - lo || 1)) * (H - PT - PB) })), [values, lo, hi]);
  const path = spline(points); const area = `${path} L ${points[11].x} ${H - PB} L ${points[0].x} ${H - PB} Z`; const current = points[month - 1]; const tone = toneFor(contact); const colors = tone === "warm" ? ["#FFB25C", "#FF5C7A"] : tone === "cool" ? ["#33E7C8", "#6C7CFF"] : ["#6F6880", "#6F6880"];
  const flag = contact.detection.flag.month_fired; const flagged = flag ? points[flag - 1] : null; const revealed = Boolean(flag && month >= flag); const dragging = useRef(false);
  const fromPointer = (clientX: number) => { const rect = ref.current?.getBoundingClientRect(); if (!rect) return; const relative = (clientX - rect.left) / rect.width * W; const next = Math.round(Math.max(0, Math.min(1, (relative - PX) / (W - PX * 2))) * 11) + 1; onMonth(next); };
  const beginDrag = (event: PointerEvent<SVGGElement>) => { dragging.current = true; event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId); fromPointer(event.clientX); };
  return <div className="pulse-chart"><svg ref={ref} viewBox={`0 0 ${W} ${H}`} onPointerMove={(event) => { if (dragging.current) fromPointer(event.clientX); }} onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }} role="img" aria-label="Twelve month relationship pulse">
    <defs><linearGradient id={`line-${contact.contact_id}`} x1="0" y1="0" x2="1" y2="0"><stop stopColor={colors[0]} /><stop offset="1" stopColor={colors[1]} /></linearGradient><linearGradient id={`area-${contact.contact_id}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={colors[1]} stopOpacity=".28" /><stop offset="1" stopColor={colors[1]} stopOpacity="0" /></linearGradient><radialGradient id={`glow-${contact.contact_id}`}><stop stopColor={colors[1]} stopOpacity=".9"/><stop offset="1" stopColor={colors[1]} stopOpacity="0"/></radialGradient></defs>
    <rect x={PX} y={PT - 4} width={3 / 11 * (W - PX * 2)} height={H - PT - PB + 8} className="chart-baseline"/><path d={area} fill={`url(#area-${contact.contact_id})`} /><path d={path} fill="none" stroke={`url(#line-${contact.contact_id})`} strokeWidth="2.4" strokeLinecap="round"/>
    {flagged && <line x1={flagged.x} x2={flagged.x} y1={PT - 4} y2={H - PB + 4} stroke={colors[1]} strokeOpacity={revealed ? .35 : .12} strokeDasharray="2 3"/>}
    <motion.g className="chart-scrubber" tabIndex={0} role="slider" aria-label={`Month ${month}; use arrow keys to move along the pulse`} aria-valuemin={1} aria-valuemax={12} aria-valuenow={month} onPointerDown={beginDrag} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); onMonth(Math.max(1, month - 1)); } if (event.key === "ArrowRight") { event.preventDefault(); onMonth(Math.min(12, month + 1)); } }}>
      <circle cx={current.x} cy={current.y} r="17" className="scrubber-hit"/><circle cx={current.x} cy={current.y} r="13" fill={`url(#glow-${contact.contact_id})`}/><motion.circle key={`${contact.contact_id}-${month}`} cx={current.x} cy={current.y} r="4.5" fill={colors[1]} stroke="#0B0810" strokeWidth="2" initial={reduced ? false : { scale: .65 }} animate={{ scale: [1, 1.45, 1] }} transition={{ duration: reduced ? .01 : .22 }}/>
    </motion.g>
  </svg></div>;
}
