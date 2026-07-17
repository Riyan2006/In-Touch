# In Touch

**Live demo:** https://in-touch-beta.vercel.app/

In Touch is a quiet relationship-signal app. Rather than reminding someone to message a friend after it has already been a long time, it notices the shape of change while it is happening: meetups falling away before calls do, texts holding on longest, or a new connection becoming regular before it feels significant. It does not assign a closeness score, rank people, or tell anyone what to do. It simply leaves a plain observation when the pattern is real.

Most “stay in touch” products are retrospective: they point out an overdue birthday or a person you have not contacted recently. In Touch is anticipatory. It looks for sustained change across the rhythm of a relationship, making the small drift or forming connection visible before it becomes obvious in hindsight.

Under the hood, the core is deterministic rather than an LLM wrapper. A seeded Python generator creates twelve months of synthetic signals for six relationship archetypes. The detection engine gives each established contact a four-month personal baseline, normalizes texts, calls, and meetups against their own histories, combines them with transparent weights, and flags a change only after it lasts for two months. New contacts use a separate cold-start rule because there is no history to normalize yet. The React/Vite interface turns that output into a draggable timeline, reports, and a quiet observation journal.

The LLM layer is intentionally narrow: it only turns a fired detection into one human-readable sentence. It is guarded against advice, scores, rankings, overly long output, and multiple sentences, with a deterministic fallback if the model cannot produce a valid line. The deployed app reads its committed synthetic JSON directly, so judges can run it without an API key.

The entire project—data generator, detection engine, tests, guarded Gemini integration, and React frontend—was built in one continuous Codex session using GPT-5.6 (Terra/Luna) as the coding agent. The one exception is the generated insight wording: at export/build time it calls the Gemini API for cost reasons, starting with `gemini-3.5-flash` and using configured Flash fallbacks during temporary capacity failures. The Gemini integration code itself, including its guardrails and fallback behavior, was written in that same Codex/GPT-5.6 session.
