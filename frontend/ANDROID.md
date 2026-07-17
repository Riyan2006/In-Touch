# Android APK release

The Android build uses Capacitor to package the same React interface as the web demo. It intentionally bundles only one fictional **Sample Contact**; the six-contact browser payload is not included in the Android build.

## Prerequisites

- JDK 21 (Capacitor 8 compiles its Android dependency with Java 21)
- Android Studio with Android SDK Platform 36 and Build Tools installed
- An Android device or emulator for installation testing

## Build and sign

From `frontend/`, generate the signing key once and store the keystore password somewhere secure outside this repository:

```powershell
keytool -genkeypair -v -keystore android-release.keystore -alias intouch-release -keyalg RSA -keysize 2048 -validity 10000
Copy-Item keystore.properties.example android\keystore.properties
```

Replace the two passwords in `android\keystore.properties` with the values chosen during key generation. Both the keystore and that properties file are ignored by Git.

Then build the Android-only web assets, sync them, and assemble the release APK:

```powershell
pnpm install
pnpm run android:sync
cd android
.\gradlew.bat assembleRelease
```

The release APK is written to `android\app\build\outputs\apk\release\app-release.apk`. Rename it to `InTouch-android.apk`, install it on an Android device to verify it offline, then attach it to a GitHub Release in `Riyan2006/In-Touch`. The website download control uses this stable URL:

```text
https://github.com/Riyan2006/In-Touch/releases/latest/download/InTouch-android.apk
```

Publish each replacement APK under the exact same filename so the website always downloads the newest release. No Play Store account, Android permissions, backend, Gemini key, or network access is required by the installed demo.
