import { motion, useReducedMotion } from "framer-motion";
import type { Contact } from "./types";
import { toneFor } from "./utils";

type Props = { contacts: Contact[]; selectedId: string; onSelect: (id: string) => void };
export default function ContactIndex({ contacts, selectedId, onSelect }: Props) {
  const reduced = useReducedMotion();
  return <div className="avatar-scroll" aria-label="Contacts">
    <div className="avatar-row">
    {contacts.map((contact) => { const active = contact.contact_id === selectedId; const tone = toneFor(contact); return <button key={contact.contact_id} className={`avatar-button ${tone} ${active ? "active" : ""}`} onClick={() => onSelect(contact.contact_id)} aria-pressed={active}>
      <motion.span className="avatar-ring" animate={active && !reduced ? { scale: 1.08 } : { scale: 1 }} transition={{ duration: .22 }}><span className="avatar-initial">{contact.name[0]}</span></motion.span><span>{contact.name}</span>
    </button>; })}
    </div><span className="scroll-cue" aria-hidden>›</span>
  </div>;
}
