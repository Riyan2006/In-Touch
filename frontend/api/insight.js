/**
 * Runtime Gemini proxy for In Touch. GEMINI_API_KEY belongs in Vercel's
 * encrypted environment settings; it is never sent to the web bundle or APK.
 */

const MODEL = "gemini-3.5-flash";
const ALLOWED_SIGNALS = new Set(["texts", "calls", "meetups"]);
const ALLOWED_FLAGS = new Set(["decay", "rise_existing", "rise_cold_start", "none"]);
const DENYLIST = ["you should", "reach out", "call them", "consider ", "score", "rank", "rated"];
const SYSTEM = `You write exactly one short, warm, matter-of-fact observation for In Touch.
Describe only the supplied aggregate relationship pattern. Never give advice, suggest action, use scoring or ranking language, moralize, mention AI, or quote yourself. Use plain language and one complete sentence of at most 32 words.`;

function allowCors(request, response) {
  const origin = Array.isArray(request.headers.origin) ? request.headers.origin[0] : request.headers.origin;
  if (origin === "https://in-touch-beta.vercel.app" || origin === "capacitor://localhost") {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function safeText(value, max) {
  return typeof value === "string" ? value.replace(/[\r\n<>]/g, " ").trim().slice(0, max) : "";
}

function validSentence(value) {
  const text = value.trim().replace(/^['"]|['"]$/g, "");
  const terminals = [...text.matchAll(/[.!?]/g)];
  return text.split(/\s+/).length <= 32
    && terminals.length === 1
    && terminals[0].index === text.length - 1
    && !DENYLIST.some((term) => text.toLowerCase().includes(term));
}

export default async function handler(request, response) {
  allowCors(request, response);
  if (request.method === "OPTIONS") return response.status(204).end();
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  if (!process.env.GEMINI_API_KEY) return response.status(503).json({ error: "Insight service is not configured" });

  const body = request.body;
  const contact_name = safeText(body?.contact_name, 80);
  const primary_signal = safeText(body?.primary_signal, 16);
  const flag_type = safeText(body?.flag_type, 24);
  const available_signals = Array.isArray(body?.available_signals)
    ? body.available_signals.filter((item) => typeof item === "string" && ALLOWED_SIGNALS.has(item)).slice(0, 3)
    : [];
  const latest_value = typeof body?.latest_value === "number" && Number.isFinite(body.latest_value) ? Number(body.latest_value.toFixed(1)) : null;
  const baseline_value = typeof body?.baseline_value === "number" && Number.isFinite(body.baseline_value) ? Number(body.baseline_value.toFixed(1)) : null;
  const month_flag_fired = typeof body?.month_flag_fired === "number" && Number.isInteger(body.month_flag_fired) ? body.month_flag_fired : null;

  if (!contact_name || !ALLOWED_SIGNALS.has(primary_signal) || !ALLOWED_FLAGS.has(flag_type) || latest_value === null) {
    return response.status(400).json({ error: "Invalid insight input" });
  }

  const aggregate = { contact_name, flag_type, primary_signal, month_flag_fired, latest_value, baseline_value, available_signals };
  try {
    const gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(aggregate) }] }],
        generationConfig: { temperature: 0.45, maxOutputTokens: 100 },
      }),
    });
    if (!gemini.ok) return response.status(502).json({ error: "Gemini could not generate an insight" });
    const payload = await gemini.json();
    const sentence = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
    if (!validSentence(sentence)) return response.status(502).json({ error: "Gemini returned an invalid insight" });
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({ sentence });
  } catch {
    return response.status(502).json({ error: "Gemini could not be reached" });
  }
}
