# In Touch

**Live demo:** https://in-touch-beta.vercel.app/

In Touch is an ambient layer for the relationships already in your life. It notices when contact is quietly fading or when a connection is beginning to form before that change is consciously obvious: fewer meetups followed by fewer calls, or a new person becoming part of the week. It is never a score, never a ranking, and never advice about what to do. It simply makes a plain, human observation when a pattern has held long enough to be worth noticing.

## Run the app

The frontend runs from the committed static demo data, so no API key is needed to view the app.

```powershell
git clone https://github.com/Riyan2006/In-Touch.git
cd In-Touch\frontend
pnpm install
pnpm run dev
```

Open the local URL printed by Vite. To create a production build:

```powershell
pnpm run build
```

## Python backend

The backend generates the synthetic relationship data, detects sustained changes, and prepares the insight inputs.

```powershell
cd In-Touch
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m intouch.validate
python -m unittest discover -s tests
```

On macOS/Linux, activate the virtual environment with `source .venv/bin/activate` instead.

`python -m intouch.validate` prints the six-contact detector summary. `python -m unittest discover -s tests` runs the full Python test suite.

## Demo data and optional Gemini export

[`frontend/src/data/demo-data.json`](frontend/src/data/demo-data.json) is already included. It is pre-generated, seeded synthetic data for six illustrative contacts, including their monthly signals, detection output, and insight text. Judges can run and view the app without a Gemini key, any API account, or a backend server.

Set `GEMINI_API_KEY` only if you want to regenerate the insight wording and overwrite the static demo payload:

```powershell
$env:GEMINI_API_KEY = "your_key_here"
python -m intouch.export_demo_data
```

The export uses Gemini for this narrow wording step only. It tries `gemini-3.5-flash` first, then configured lower-cost Flash fallbacks when a temporary capacity or quota failure occurs. If Gemini is unavailable, the exporter logs a clear warning and produces a deterministic fallback sentence rather than failing silently. The committed JSON lets the deployed app run without invoking Gemini.

## How it works

- A seeded Python generator creates twelve months of synthetic signals for six archetypes: fading lead, stable, already faded, early drift, warming up, and a cold-start connection.
- The deterministic detector establishes a four-month per-contact baseline, normalizes meetups, calls, and texts against their own histories, then combines them with weights of 0.4, 0.4, and 0.2.
- A decay or existing-contact rise requires a weighted z-score to stay beyond its threshold for two consecutive months. A cold start uses a separate eight-week reference-frequency and still-climbing rule because it has no personal baseline yet.
- A guarded Gemini call turns only fired flags into a single observation sentence. Validation rejects advice, scoring language, overly long output, and multi-sentence output before a deterministic fallback is used.

## Codex and GPT-5.6

The entire codebase was built in one continuous Codex session running GPT-5.6 (Terra/Luna) as the coding agent. That session implemented the seeded data generator and its six archetypes, the explainable detection engine and tests, the guarded insight-input and validation layer, the static React/Vite/Framer Motion experience, and later accessibility, reporting, settings, and visual-polish work.

The one exception is the generated wording itself: at export/build time, the insight feature calls the Gemini API for cost reasons, starting with `gemini-3.5-flash`. Everything around that call—including prompt design, model fallback behavior, validation, logging, fallback templates, export wiring, and all frontend code—was written in that continuous Codex/GPT-5.6 session.

## Project structure

```text
intouch/
  generator.py          Seeded, configurable synthetic contact data
  detection.py          Baselines, z-scores, sustained flags, cold-start rule
  insights.py           Narrow Gemini wording layer and guardrails
  export_demo_data.py   Consolidates pipeline output for the frontend
  validate.py           Prints the six-contact validation summary
tests/
  test_detection.py     Deterministic detection and threshold tests
  test_insights.py      Insight-input, guardrail, fallback, and opt-in API tests
frontend/
  src/                  React + TypeScript + Framer Motion phone demo
  src/data/demo-data.json  Committed static payload consumed by the UI
```

## Testing

Run the two Python test modules together:

```powershell
python -m unittest discover -s tests
```

`tests/test_detection.py` covers baselines, per-signal normalization, sustained decay/rise thresholds, the cold-start rule, and the expected six-contact outcomes. `tests/test_insights.py` covers insight-input assembly, validation guardrails, and model fallback behavior.

One integration test makes a real Gemini call only when both environment variables are set; it is skipped by default:

```powershell
$env:RUN_GEMINI_INTEGRATION = "1"
$env:GEMINI_API_KEY = "your_key_here"
python -m unittest tests.test_insights
```

## MVP limitations

- All relationship data is synthetic; there is no Calendar, Contacts, WhatsApp, or messaging integration yet.
- The demo intentionally observes contact frequency only, never message content.
- People added from the UI are local-only session state: they appear in Tracked People and Reports but are not persisted or added to the home contact rail.
- There is no account system, multi-user collaboration, or backend API server in this MVP.
