import { useEffect, useState } from "react";
import "./margin-whispers.css";

const lines = [
  "Friendships don't end. They quiet down, one week at a time.",
  "You never decide to drift. It just happens, unnoticed.",
  "Closeness has a shape — most of us only see it in hindsight.",
  "A friendship doesn't end on a day. It ends on an average.",
  "The texts kept coming, long after the calls stopped.",
  "Some connections arrive slowly. Some arrive all at once.",
  "Not a score. Not a ranking. Just a shape, over time.",
  "We remember beginnings. We rarely notice endings.",
];

function shuffledLines() { return [...lines].sort(() => Math.random() - .5); }

export default function MarginWhispers() {
  const [orderedLines] = useState(shuffledLines);
  useEffect(() => {
    const updatePointer = (event: PointerEvent) => {
      document.documentElement.style.setProperty("--mouse-x", `${event.clientX}px`);
      document.documentElement.style.setProperty("--mouse-y", `${event.clientY}px`);
    };
    window.addEventListener("pointermove", updatePointer, { passive: true });
    return () => window.removeEventListener("pointermove", updatePointer);
  }, []);

  return <aside className="margin-whispers" aria-hidden="true">{orderedLines.map((line, index) => { const side = index % 2 === 0 ? "left" : "right"; const slot = Math.floor(index / 2); return <p className={`margin-whisper whisper-${side}-${slot}`} data-slot={slot} key={line}><span>{line}</span></p>; })}</aside>;
}
