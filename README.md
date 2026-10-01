# PulsePoint Android prototype

COMP826 Mobile Systems Development, Milestone 2. This is an Android prototype for symptom urgency assessment, nearby-care search and related medicine/profile functions. It is not clinically validated.

## Install and run

1. Install Node **20.19.4 or newer**, npm, **JDK 17** and Android Studio. The checked React Native toolchain uses Android **compile/target SDK 36**, build tools **36.0.0** and NDK **27.1.12297006**. Install the required SDK components through Android Studio. Device minimum is **API 29**.
2. Clone the repository and enter it:

   ```powershell
   git clone https://github.com/ijaydevpatel/PulsePointApp.git
   cd PulsePointApp
   npm install
   ```

3. Prepare client configuration:

   ```powershell
   Copy-Item .env.example .env
   ```

   Set `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` and `EXPO_PUBLIC_API_URL`. The API value is an origin only, without `/api` or a trailing slash. Use a Clerk project and backend that you are authorised to access. Server secrets, including database connection strings, must not be bundled into the app. `.env` is ignored by Git.

4. Generate Android files:

   ```powershell
   npm run prebuild
   ```

   `android/` is generated and ignored. The package script also runs the project's debug JS-bundle helper. Prefer it to a bare Expo prebuild command when reproducing this project.

5. Connect an Android device with USB debugging, or start an emulator. Run:

   ```powershell
   npm run android
   ```

   You can also open the generated `android/` folder in Android Studio. Authentication needs the Clerk configuration; remote analysis, profile and chat need a compatible backend. Map tiles and facility queries need connectivity.

6. Run verification:

   ```powershell
   npm run verify
   ```

   It runs `typecheck`, `lint:boundaries`, `contrast` and `test`. There is no `npm run lint` script. Individual commands are available in `package.json`.

7. Build a release APK:

   ```powershell
   cd android
   .\gradlew.bat assembleRelease
   ```

   Check `app/build/outputs/apk/release/`. The checked generated release configuration uses the **debug signing key**. It is not a production-signing setup. Configure release signing separately before distribution.

## Current functions

The five tabs are Home, Symptoms, Medicines, AI Doctor and Care. Profile and Settings open Records as an overlay.

- Symptoms uses a local rules engine and saves the result. Selected symptom labels and free text are also submitted for remote analysis when the service is available.
- Result shows urgency advice, confidence information and red flags. Non-escalated display can wait for remote analysis or a 12-second reveal timer. There is no result-rating control.
- Medicines supports information lookup and interaction checks through CollisionScreen.
- AI Doctor uses a remote chat service. It is not a clinician consultation service.
- Care queries Overpass in three expanding coordinate boxes, with mirror racing and a short in-memory cache. Directions opens an external maps application.
- Records stores episode/activity history on the device. Profile data is handled remotely.

News/check-in routes and additional service modules exist, but those routes have no entry from the currently rendered tab controls. They are not listed as demonstrated features. A TensorFlow Lite adapter exists but AppContent constructs RuleClassifier.

## Code structure

`index.ts` registers App, which re-exports `src/ui/App.tsx`. AppContent constructs the classifier, store and services and manages tabs/overlays.

`src/domain/` contains the types, contracts and use cases. `src/data/` contains adapters, including RuleClassifier, DurableEpisodeStore, SQLite/memory storage, ApiClient, remote services and Overpass. `src/ui/screens/` contains React screen functions; `src/ui/components/` contains shared controls. State uses hooks and callbacks, not a named ViewModel class.

The domain boundary script checks direct imports and forbidden patterns. It is not a complete transitive dependency analyser. The documentation includes a separate static import audit.

## Storage and privacy limits

DurableEpisodeStore retains one active delegate. It attempts SQLite and replaces it with memory if initialization fails. Memory fallback loses history when the app restarts.

SqliteEpisodeStore generates a SecureStore key and issues `PRAGMA key`, but **SQLCipher is not enabled in the checked Expo/native configuration**. Native encryption support has not been verified. Do not treat the Records screen's current encrypted-storage wording as evidence of encryption.

Stored history is local; optional remote analysis sends symptom information, and other services process profile, medicine or chat requests. Local records do not mean every health-related value stays on the device. There is no working background episode-history synchronisation service.

## Verified checks and missing measurements

Verification on 1 October 2026 returned **442 passing tests in 23 suites**, passing TypeScript/direct-boundary checks and **84 passing contrast pairs**. Jest emitted an open-handle warning after the assertions completed. The suite does not prove native encryption, clinical accuracy or complete accessibility compliance.

Reported device timing, APK size and restart observations need reproducible logs/build identifiers. Cold start, RAM and battery have no measured results. SUS has not been conducted. The documentation's Nielsen review is a source-based inspection, not a device walkthrough or participant study.

## Before assessment submission

Add genuine implementation screenshots and a demonstration link. Complete device-based evaluation and process evidence where required. Check assessor access to the repository, commit the required documentation, export the report PDF and submit a ZIP of the main branch on Canvas. Do not put private keys or `.env` into either repository or ZIP.
