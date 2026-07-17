import { useState } from "react";
import type { Contact } from "./types";
import { contactFromWhatsApp, parseWhatsAppExport, type ChatMonth, type ParseFailure } from "./whatsapp";
import "./whatsapp-import.css";

const errorMessage: Record<ParseFailure, string> = {
  unrecognized_format: "We couldn’t recognize this as an Android or iOS WhatsApp chat export.",
  no_messages: "No messages were found after system and placeholder messages were excluded.",
  under_four_months: "Need at least 4 months of chat history to establish a baseline.",
};

type Props = { onClose: () => void; onImported: (contact: Contact) => void };

export default function WhatsAppImport({ onClose, onImported }: Props) {
  const [name, setName] = useState("");
  const [months, setMonths] = useState<ChatMonth[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const readFile = async (file: File | undefined) => {
    setMonths(null); setError(null); setFileName("");
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".txt")) { setError("Choose a WhatsApp .txt export."); return; }
    try {
      const rawText = await file.text();
      const result = parseWhatsAppExport(rawText);
      if ("error" in result) { setError(errorMessage[result.error]); return; }
      setFileName(file.name); setMonths(result.months);
    } catch {
      setError("This file could not be read. Try exporting the chat again as a .txt file.");
    }
  };

  const confirm = () => { if (months && name.trim()) onImported(contactFromWhatsApp(name.trim(), months)); };

  return <div className="modal-backdrop whatsapp-backdrop" onClick={onClose}><section className="whatsapp-import" aria-label="Add from WhatsApp export" onClick={(event) => event.stopPropagation()}><button className="form-close" type="button" aria-label="Close" onClick={onClose}>×</button>{months ? <><header><p>WhatsApp export</p><h3>Check the monthly count</h3><span>These are the only values In Touch keeps for this session.</span></header><div className="monthly-preview" aria-label="Derived monthly message counts">{months.map((month) => <div key={month.label}><span>{month.label}</span><strong>{month.message_count}</strong><small>messages · {month.texts_per_week.toFixed(1)}/wk</small></div>)}</div><p className="privacy-statement">Processed entirely on your device. Message content is never read, stored, or transmitted.</p><button className="submit-person" type="button" disabled={!name.trim()} onClick={confirm}>Add {name.trim() || "contact"} to tracking</button></> : <><header><p>WhatsApp export</p><h3>Add from WhatsApp export</h3><span>Choose an exported chat file to derive a texts-only relationship timeline.</span></header><p className="privacy-statement">Processed entirely on your device. Message content is never read, stored, or transmitted.</p><label className="import-name">Display name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Their name in In Touch" autoFocus/></label><label className="chat-file-picker">Choose WhatsApp .txt export<input type="file" accept=".txt,text/plain" onChange={(event) => void readFile(event.target.files?.[0])}/></label>{fileName && <p className="file-name">{fileName}</p>}{error && <p className="import-error" role="alert">{error}</p>}<p className="import-help">Supports Android and iOS chat exports. At least four calendar months are needed to establish a baseline.</p></>}</section></div>;
}
