# Building PulsePoint in Android Studio

This is a React Native app. It still produces a **real, native Android Gradle project**
that you open and run in Android Studio exactly like any other Android app — you get the
emulator, the debugger, Logcat, the APK, all of it.

The one extra step is that the `android/` folder is **generated**, not committed. You
generate it once with `expo prebuild`. This is standard practice: the folder is large,
machine-specific, and fully reproducible from `app.json`.

---

## One-time setup

### 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20 LTS or newer | https://nodejs.org |
| Android Studio | Ladybug (2024.2) or newer | https://developer.android.com/studio |
| JDK | 17 | Bundled with Android Studio — set `JAVA_HOME` to it |
| Android SDK | Platform 35 + Build-Tools 35 | Android Studio → Settings → SDK Manager |

In Android Studio: **Settings → Languages & Frameworks → Android SDK → SDK Platforms**,
tick **Android 15 (API 35)**. Then the **SDK Tools** tab → tick **Android SDK Build-Tools**
and **Android Emulator**.

### 2. Set the environment variable (Windows)

`ANDROID_HOME` must point at your SDK. In PowerShell:

```powershell
setx ANDROID_HOME "$env:LOCALAPPDATA\Android\Sdk"
```

Close and reopen your terminal afterwards.

### 3. Install dependencies and generate the native project

```powershell
cd "$env:USERPROFILE\Desktop\MSD\PulsePointApp"
npm install
npx expo prebuild --platform android
```

`prebuild` reads `app.json` and writes the `android/` folder: Gradle files, the manifest,
the package name `nz.ac.aut.comp826.pulsepoint`, minSdk 29, targetSdk 35.

---

## Open it in Android Studio

1. **File → Open**
2. Select the **`PulsePointApp/android`** folder — *not* `PulsePointApp` itself.
   Android Studio needs the folder containing `settings.gradle`.
3. Wait for Gradle sync to finish (first run downloads a lot; be patient).
4. Pick a device in the toolbar — either a connected phone with USB debugging on,
   or **Device Manager → Create Device** for an emulator (Pixel 7, API 35).
5. Press **Run ▶**.

The app installs and launches. Metro (the JavaScript bundler) starts automatically.
If it doesn't, run `npx expo start --dev-client` in a second terminal.

---

## The everyday loop

| What you want | What to do |
|---|---|
| Change UI or logic | Edit the `.ts`/`.tsx` files — the app hot-reloads, no rebuild |
| Change `app.json`, permissions, native config | `npx expo prebuild --platform android --clean`, re-sync Gradle |
| Run domain tests | `npm test` — plain Node, no emulator needed |
| Typecheck | `npm run typecheck` |
| Check domain boundaries (criterion E3) | `npm run lint:boundaries` |
| Build a release APK | Android Studio → **Build → Generate Signed App Bundle / APK** |

**You do not need to rebuild in Android Studio for JavaScript changes.** Only native
config changes require a Gradle rebuild. This is why the phased plan front-loads the
native work: once `android/` exists, Phases 2–7 are almost entirely JS/TS.

---

## Where the native side matters later

| Phase | Why it touches Android Studio |
|---|---|
| 2 — Persistence | `expo-sqlite` + SQLCipher needs a prebuild after install |
| 3 — Care locator | Location permission goes in `app.json`, then prebuild |
| 4 — On-device ML | TensorFlow Lite `.tflite` asset + NNAPI delegate; you'll profile inference in Android Studio's CPU Profiler for criterion E6 |
| 7 — Evaluation | APK size and cold-start numbers (E10) come from the Studio build + profiler |

---

## Troubleshooting

**"SDK location not found"** — create `android/local.properties` containing:
```
sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk
```

**Gradle sync fails on JDK version** — File → Settings → Build Tools → Gradle →
set **Gradle JDK** to the bundled JDK 17.

**Metro can't connect from a physical device** — `adb reverse tcp:8081 tcp:8081`

**Anything weird after changing config** — `npx expo prebuild --platform android --clean`
regenerates `android/` from scratch. Safe to do; nothing of yours lives there.
