# Android APK release

The Android build uses Capacitor to package the full-screen In Touch app—not the browser marketing shell or phone mockup. It intentionally starts with one fictional **Sample Contact**; the browser’s six-contact synthetic payload is excluded from the Android build.

The installed app works from bundled assets and does not need a backend, Gemini key, or account for its built-in demo. It works offline with local fallback wording; when a fired report is opened while online, it can request a fresh one-sentence observation through the deployed Vercel Gemini endpoint. User-added local sources are described below.

## What Android adds

- **Tracked-person persistence:** Capacitor Preferences retains manual people, imported source-derived monthly counts, the selected contact, and the selected theme across app closes. The built-in Sample Contact remains a single built-in item and is not duplicated.
- **WhatsApp `.txt` imports:** Android and iOS-style WhatsApp export formats are parsed on-device. The parser keeps monthly message counts only; message bodies are discarded immediately after the local system/placeholder exclusion check and are never stored, logged, or transmitted. Four calendar months are required for texts-only detection.
- **Calendar meetup imports:** The app declares `READ_CALENDAR`, but requests it only after the user selects **Find calendar meetups**. It scans the preceding twelve months of the device’s synced calendar and matches invited attendees by supplied email first, then normalized attendee name. A user may opt into a final title-name match. Raw titles, notes, places, guest lists, and identifiers are discarded after comparison; only per-month meetup counts are returned and persisted.
- **Combined sources:** A WhatsApp export and calendar import can be attached to the same tracked person. When there are at least four overlapping calendar months, In Touch aligns their texts and meetups into one combined pattern. Calls remain unavailable.
- **Theme choice:** On first launch, the app asks for dark (moon) or light (sun). That preference persists on the device and can be changed later in Settings.

Calendar data measures scheduled shared time, not confirmed attendance. Calendar-only and combined views visibly label the unavailable signals instead of showing fake zeroes.

## Prerequisites

- JDK 21 (Capacitor 8 compiles its Android dependency with Java 21)
- Android Studio with Android SDK Platform 36 and Build Tools installed
- An Android device or emulator for installation testing

If Gradle cannot locate the SDK, create `android/local.properties` with the local SDK directory, for example:

```properties
sdk.dir=C\:\\Users\\your-name\\AppData\\Local\\Android\\Sdk
```

## Build and sign

From `frontend/`, generate the signing key once and retain it, its alias, and passwords securely outside Git. Losing that key prevents future signed updates under the same app identity.

```powershell
keytool -genkeypair -v -keystore android-release.keystore -alias intouch-release -keyalg RSA -keysize 2048 -validity 10000
Copy-Item keystore.properties.example android\keystore.properties
```

Edit `android\keystore.properties` with the password and alias chosen during key generation. The template’s `storeFile=../android-release.keystore` resolves to the keystore created in `frontend/`. Both the keystore and copied properties file are ignored by Git; never commit either one.

Build the Android-specific React bundle, sync it into Capacitor, and assemble the signed release:

```powershell
pnpm install
pnpm run android:sync
cd android
.\gradlew.bat assembleRelease
```

The release APK is created at:

```text
android\app\build\outputs\apk\release\app-release.apk
```

Rename it to `InTouch-android.apk`, install it on a device or emulator, and test it offline. On a fresh install, verify that the theme picker appears once, then verify that a tracked person or import remains present after a full close and reopen.

## Direct installation and GitHub Release

This APK is distributed directly, not through Google Play. Android will show its normal “install unknown apps” or security prompt when the browser/file manager opens it. That warning is expected for a sideloaded build; allow that installer source to continue only after confirming it is your release asset.

Attach the verified APK to a GitHub Release in `Riyan2006/In-Touch` under this exact filename:

```text
InTouch-android.apk
```

The website’s Android download button uses the stable latest-release address:

```text
https://github.com/Riyan2006/In-Touch/releases/latest/download/InTouch-android.apk
```

Publish each replacement APK with the same filename so the website continues to resolve the newest release.

## Not included

- Call-log access is intentionally not implemented. Android reserves practical `READ_CALL_LOG` access for default dialer/SMS-role apps; In Touch does not take over calling or messaging, including when sideloaded.
- There is no Contacts integration, account system, cloud sync, backend API, or Play Store distribution.
- Calendar data is local and is never uploaded. It is a schedule signal, not proof of attendance.
