# In Touch

**Live demo:** [in-touch-beta.vercel.app](https://in-touch-beta.vercel.app/)

In Touch is an ambient relationship-pattern observer. It notices a friendship getting quieter or a connection becoming more regular before that shift is consciously obvious. It is never a score, never a ranking, and never advice: it makes a plain observation only when a pattern has held long enough to be worth noticing.

## Run the web demo

The web app uses committed static data, so no backend or API key is needed to view it.

```powershell
git clone https://github.com/Riyan2006/In-Touch.git
cd In-Touch\frontend
pnpm install
pnpm run dev
```

Open the local URL printed by Vite. For a production build:

```powershell
pnpm run build
```

## Platform support

| Capability | Web demo | Android APK |
| --- | --- | --- |
| Built-in demo | Six seeded synthetic contacts | One fictional Sample Contact |
| Manual tracked people | Yes, session-only | Yes, persisted on device |
| WhatsApp `.txt` export | Yes, client-side | Yes, client-side and persisted on device after confirmation |
| Calendar meetup scan | Visible but disabled with an Android-only note | Yes, on demand with `READ_CALENDAR` permission |
| Combining WhatsApp texts and calendar meetups for one person | Not available from the web UI | Yes, when the two imports have at least four overlapping calendar months |
| Theme toggle | Outer page corner; resets to dark on a fresh page load | First-launch picker and Settings control; choice persists on device |
| Gemini/API key needed to use the UI | No | No |

## Python backend

The Python package generates the seeded six-contact dataset, detects sustained changes, and optionally prepares insight wording for the browser payload.

```powershell
cd In-Touch
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m intouch.validate
python -m unittest discover -s tests
```

On macOS/Linux, activate with `source .venv/bin/activate` instead. `python -m intouch.validate` prints the six-contact detector summary.

## Detection model

- Established contacts receive a baseline from their first four available months. Meetups, calls, and texts are normalized against their own history and combined at weights `0.4`, `0.4`, and `0.2`.
- A decay or an existing-contact rise fires only after the combined z-score stays past `-1.0` or `+1.0` for two consecutive months.
- A cold-start contact has no personal history, so it uses a separate eight-week frequency-and-growth rule. Its reference is personalized: In Touch averages the first-four-month baselines of this user’s established contacts once per dataset. The old `2 meetups / 4 calls / 20 texts per week` levels are retained only as an edge-case fallback when a dataset has no established contacts at all.

## Real-data imports and privacy

### WhatsApp export — web and Android

Tracked People can import a WhatsApp `.txt` export. The parser supports the common Android and iOS timestamp formats, treats continuation lines as part of the preceding message rather than a new message, excludes system/placeholder entries, buckets the most recent twelve calendar months, and requires at least four months of history.

Parsing happens entirely on the device. Message body text is used only for the immediate local system-message exclusion check, then discarded; it is never retained, logged, stored, or transmitted. The resulting contact uses **texts-only** detection: texts are normalized against the first four months, while calls and meetups are visibly unavailable rather than represented by fake zeroes.

### Calendar meetups — Android only

The Android app can scan the last twelve months of the phone’s synced calendar after the user explicitly starts **Find calendar meetups**. `READ_CALENDAR` is declared in the APK and requested only at that point. For each event, matching checks invited attendees in this order: supplied email address first, then normalized attendee name, followed by an optional, user-enabled title-name match. Event titles, notes, locations, guest lists, identifiers, and raw event details are discarded after the immediate comparison; only monthly meetup counts are returned and persisted.

Calendar imports use **meetups-only** detection, with calls and texts marked unavailable. They measure scheduled shared time, not confirmed attendance. On Android, a WhatsApp import and a calendar import can be attached to the same tracked person; when they overlap for at least four calendar months, the app aligns them and detects a combined texts-plus-meetups pattern. Calls remain unavailable in that combined view.

## Theme and interaction design

Dark jewel tones are the default. The web page has a small sun/moon utility toggle outside the phone mockup; its light-theme choice applies to the current page and resets to dark after a fresh load. On Android, the first launch asks for a sun or moon choice, persists it with Capacitor Preferences, and exposes the same toggle later in Settings.

The desktop-only margin text retains its radial “torchlight” reveal in both themes: it reveals pale italic text in dark mode and ink-colored text in light mode. Warm amber/rose continues to denote fading; cool teal/violet continues to denote forming.

## Android APK (Android only)

The website has an explicitly marked **Android only — APK download** control. The installed Capacitor app is a real full-screen app surface, not a webpage wrapped around a phone mockup. It intentionally starts with just one fictional **Sample Contact**, not the browser’s six demo contacts.

To build and sign it, install JDK 21 and Android Studio/SDK, then follow [frontend/ANDROID.md](frontend/ANDROID.md). The APK is distributed directly from a GitHub Release, not the Play Store. Android will therefore show its normal unknown-source/security prompt during installation; this is expected for a sideloaded APK, and the installer must be allowed to continue.

## Demo data and optional Gemini export

[`frontend/src/data/demo-data.json`](frontend/src/data/demo-data.json) is the committed seeded synthetic payload for the browser’s six illustrative contacts. It includes monthly signals, detector output, and insight text, so judges can run the web app without Gemini, an API account, or a backend server.

Set `GEMINI_API_KEY` only to regenerate those insight sentences and overwrite that static file:

```powershell
$env:GEMINI_API_KEY = "your_key_here"
python -m intouch.export_demo_data
```

The export code tries `gemini-3.5-flash`, then `gemini-3.1-flash-lite`, `gemini-2.5-flash`, and `gemini-2.5-flash-lite` after a temporary capacity, quota, or availability failure. Each model gets one stricter retry only when its generated prose fails validation; a non-temporary API/key/SDK failure, two invalid responses from a model, or exhaustion of the temporary-failure chain produces a logged deterministic template fallback.

### Runtime Gemini reports

The web deployment and Android app can also ask Gemini to phrase a fired report when that report is opened. The key remains private: set `GEMINI_API_KEY` in the **Vercel project’s Environment Variables** for Production (and Preview if wanted), then redeploy. It is read only by `frontend/api/insight.ts`; it is never committed, shipped in the web bundle, or placed in the APK. The runtime request contains only a sanitized aggregate summary—contact display name, flag type, signal name, baseline/latest value, and available-signal labels—never message text, calendar event details, files, or identifiers. If the endpoint is unavailable, the UI keeps working with its local deterministic wording.

## Codex and GPT-5.6

The whole project was built in one continuous Codex session using GPT-5.6 (Terra/Luna) as the coding agent. That work covers the seeded generator, deterministic detection engine and tests, guarded Gemini integration, React/Vite/Framer Motion interface, Android Capacitor packaging, WhatsApp and Calendar data paths, persistence, accessibility, themes, and visual polish.

The only model exception is generated insight wording during optional export: it calls Gemini for cost reasons. The Gemini integration itself—prompt, model fallback chain, validation, warning logs, template fallback, and export wiring—was also authored in that continuous Codex/GPT-5.6 session.

## Project structure

```text
intouch/
  generator.py             Seeded, configurable synthetic contacts
  detection.py             Baselines, z-scores, sustained flags, personalized cold-start reference
  insights.py              Guarded Gemini wording and deterministic fallback
  export_demo_data.py      Exports the browser demo payload
  validate.py              Prints the six-contact validation summary
tests/
  test_detection.py        Python detection and personalized-reference tests
  test_insights.py         Insight input, guardrail, fallback, and opt-in API tests
frontend/
  src/                     React, TypeScript, Framer Motion, imports, and client-side detectors
  src/data/demo-data.json  Six-contact browser payload
  src/data/sample-data.ts  One-contact Android payload
  android/                 Capacitor app, Calendar plugin, signing configuration
  ANDROID.md               Android build, install, privacy, and release guide
```

## Testing

Python tests:

```powershell
python -m unittest discover -s tests
```

Frontend tests for WhatsApp parsing, text-only detection, Calendar-only detection, and combined-source alignment:

```powershell
cd frontend
pnpm test
pnpm run build
pnpm run build:android
```

The opt-in Gemini integration test is skipped by default and makes a real API call only when both variables are set:

```powershell
$env:RUN_GEMINI_INTEGRATION = "1"
$env:GEMINI_API_KEY = "your_key_here"
python -m unittest tests.test_insights
```

## Intentional MVP limits

- The browser’s built-in contacts and Android’s Sample Contact are illustrative synthetic data.
- Imported WhatsApp and Calendar counts are local, session-only on the web. Android persists tracked people, source-derived monthly counts, selected contact, and theme with Capacitor Preferences; it does not sync them to a server or account.
- There is no Contacts integration, backend API, multi-user system, or cloud synchronization.
- Call-log integration is deliberately not built. Android’s `READ_CALL_LOG` access is restricted in practice to default dialer/SMS-role apps and is not appropriate for this sideloaded app, which deliberately does not take over phone calling or messaging.
- Calendar events represent scheduled time rather than confirmed attendance, and chat exports represent message frequency rather than message meaning.
