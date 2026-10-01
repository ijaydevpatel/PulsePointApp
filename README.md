# PulsePoint

**Work out how urgent a symptom is, then find the nearest place that can help.**

Most symptom checkers tell you how worried to be but have no idea what is open near you.
Most map apps list clinics but have no idea how unwell you are. PulsePoint does both: a
short guided check returns an urgency band *with the reasoning that produced it*, and a
live map shows the medical facilities that are genuinely nearby, with a phone number and
a route.

It does not diagnose, and it says so on the result screen.

![Platform](https://img.shields.io/badge/platform-Android%2010%2B-3DDC84)
![Expo](https://img.shields.io/badge/Expo-SDK%2054-000020)
![React Native](https://img.shields.io/badge/React%20Native-0.81-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9%20strict-3178C6)
![Tests](https://img.shields.io/badge/tests-442%20passing-brightgreen)

---

## Screenshots

<!-- Drop six PNGs into docs/screenshots/ and the table below will render them. -->

| Triage | Result | Care map |
|:--:|:--:|:--:|
| <img src="docs/screenshots/triage.png" width="220"> | <img src="docs/screenshots/result.png" width="220"> | <img src="docs/screenshots/care.png" width="220"> |

| Medicines | Records | Profile |
|:--:|:--:|:--:|
| <img src="docs/screenshots/medicines.png" width="220"> | <img src="docs/screenshots/records.png" width="220"> | <img src="docs/screenshots/profile.png" width="220"> |

---

## What it does

- **Urgency triage.** Pick symptoms with a severity and duration; the app returns one of
  four bands — self-care, pharmacy/GP, urgent, emergency — and lists the rules that
  produced it. Red-flag rules run *before* scoring and can only escalate.
- **Nearby care.** Live OpenStreetMap search over three widening rings, rendered as each
  ring returns rather than after the whole search. Pins are labelled, tapping one opens a
  callout, and Directions hands off to your maps app with a real route.
- **Medicine interactions.** Type two drug names and get a risk level from an on-device
  interaction table. Works with no connection.
- **History.** Every check is written to a local database with what was asked and what the
  result was. Deletion is permanent.
- **Health profile.** Blood group, allergies, conditions and medications, synced to your
  account.
- **Second opinion (optional).** A check can be sent to the backend for a model-assisted
  analysis. The local result is kept either way, so a failure costs nothing.

---

## Quick start

**Prerequisites** — Node 20+, JDK 17, Android Studio with the SDK for Expo SDK 54, and a
device or emulator running Android 10 (API 29) or later.

```bash
git clone https://github.com/ijaydevpatel/PulsePointApp.git
cd PulsePointApp
npm install

cp .env.example .env          # then fill in the two values below
npm run prebuild              # generates the native android/ project
npm run android               # build and launch
```

The app builds and runs without `.env`; sign-in and the optional remote analysis are
simply disabled.

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk sign-in. Publishable key only. |
| `EXPO_PUBLIC_API_BASE_URL` | Origin of the PulsePoint API. |

Server-side credentials never belong in the app. `.env` is git-ignored and a unit test
fails the build if a credential-shaped string reaches source control.

To open the project in Android Studio: **File → Open →** `PulsePointApp/android`, then
**Run ▶**.

> `android/` is generated, not committed — it is machine-specific and fully reproducible
> from `app.json`. Regenerate at any time with `npm run prebuild:clean`.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run verify` | The full gate: typecheck → boundaries → contrast → tests |
| `npm test` | 442 tests across 23 suites. No emulator, no network, no database. |
| `npm run typecheck` | `tsc --noEmit`, strict mode |
| `npm run lint:boundaries` | Fails if the domain layer imports React, Expo, SQLite or any network client |
| `npm run contrast` | Checks 84 foreground/background pairs against WCAG 2.2 AA in both themes |
| `npm run audit` | Dependency gate (see below) |
| `npm run android` | Build and launch on a connected device or emulator |
| `npm run prebuild:clean` | Regenerate `android/` from scratch |

---

## Architecture

Clean Architecture with a strict inward dependency rule, enforced by a script rather than
by convention.

```
src/domain/     imports nothing platform-specific — enforced by npm run lint:boundaries
  entities.ts        SymptomEpisode, TriageResult, TriageBand, requiresEscalation()
  redFlags.ts        safety rules; run before scoring, never suppressed
  ports.ts           Classifier, EpisodeStore, ActivityLog, InteractionRepository
  assessSymptoms.ts  the use case: red flags → classify → combine, escalate-only
  facilities.ts      Facility, FacilityKind, distance and ranking

src/data/       implements the domain's interfaces
  ruleClassifier.ts     saturating noisy-OR scoring engine
  durableEpisodeStore   SQLite with an in-memory fallback if the database will not open
  overpassFacilities    live OpenStreetMap search, four mirrors raced
  remoteServices.ts     six API adapters over one authenticated client
  locationFix.ts        two-stage position fix, rejects mocked readings

src/ui/         React function components; no business rules
  screens/ components/ nav/ auth/

scripts/check-domain-boundaries.js    the dependency rule, as a build gate
scripts/contrast-audit.js             the accessibility gate
```

**Why this shape.** Every outward dependency sits behind an interface the domain owns, so
the classifier, the store and the facility source can each be swapped without touching
anything above them. That is also why the test suite needs no emulator: the whole domain
is plain TypeScript.

---

## Safety design

`AssessSymptomsUseCase` runs in a fixed order, and the order is the point:

1. **Red-flag rules first** — deterministic, readable, reviewable line by line.
2. **Then** the classifier scores the episode.
3. **Combine so the result can only escalate, never de-escalate.**

Three tests lock this in: a red flag escalates even when the classifier returns 1/100, low
confidence cannot suppress an escalation, and a high score is never pulled down.

### Scoring model

The classifier uses a **saturating (noisy-OR) aggregate**, not a linear sum. A linear sum
is unbounded, so it cannot map onto band thresholds without arbitrary rescaling, and it
lets many trivial symptoms out-vote one serious symptom. Current calibration:

| Presentation | Severity | Band |
|---|---:|---|
| Mild sore throat | 6 | Self-care |
| Flu-like, 3 days | 48 | Pharmacy / GP |
| Child, fever + vomiting | 56 | Urgent |
| Chest pain + breathlessness + radiating pain | 89 | Emergency (red flag) |

---

## Data and privacy

| Data | Where it lives |
|---|---|
| Episode history, activity log | On the device only. Never uploaded. |
| Database key | Android keystore, via `expo-secure-store`. |
| Health profile | Your account, over HTTPS. |
| Symptom data | Stays local **unless** you request the optional remote analysis, which posts it to the API. |

The store requests an encrypted database with a `PRAGMA key`, but the SQLCipher build
variant of `expo-sqlite` is **not currently enabled**, so that key is accepted and ignored
and the local database is not encrypted at rest. Enabling it is the top item on the
roadmap. Until then, treat the device lock screen as the only protection on local history.

---

## Dependency security

`npm audit` reports findings that trace back to two upstream packages, and neither reaches
the shipped APK — Metro only bundles what the app imports, and none of these are imported
by application code.

| Package | Severity | Where it lives | Status |
|---|---|---|---|
| `postcss` | high + moderate | `@expo/metro-config`, build time | **Fixed** — pinned to `^8.5.26` via `overrides` |
| `image-size` | high | `metro` bundler, build time | **No fix published.** Denial-of-service in the ICNS/JXL parsers, reachable only by feeding hostile image files to the bundler at build time. |
| `uuid` | moderate | `xcode`, iOS project generation | **Not overridden deliberately.** `xcode` requires `uuid@^7`; forcing `uuid@11` breaks it. Runs only during iOS prebuild. |

Do not run `npm audit fix --force` — it ignores Expo's version pinning and breaks the SDK.
Re-check with `npm run audit` after each SDK upgrade; the SDK 52 → 54 move alone took this
from 31 findings (one critical) to 20.

---

## Status and roadmap

Android only. The app is feature-complete for its current scope and every automated gate
passes; the open work is verification and reach rather than features.

| | Item |
|---|---|
| ✅ | Triage engine, red flags, result reasoning |
| ✅ | Live facility search, map, directions handoff |
| ✅ | Medicine interaction checking |
| ✅ | Local history and activity log |
| ✅ | Profile sync, Clerk authentication |
| ✅ | 442 tests, boundary gate, 84-pair contrast gate |
| ⬜ | **Enable the SQLCipher build variant** and verify encryption on-device |
| ⬜ | On-device analysis with a small quantised model (the `ModelBackend` seam exists) |
| ⬜ | Genuine offline mode — durable caching for facilities and the interaction table |
| ⬜ | iOS build and test pass |
| ⬜ | Clinical review of the red-flag rules and thresholds |

### Known limitations

- Facility search needs a connection, and coverage is only as good as OpenStreetMap in
  your area — good in central Auckland, thinner rurally, and the app cannot tell which.
- The triage rules are **not clinically validated** and have not been reviewed by a
  clinician. They err toward caution, which means they will over-refer.
- The AI chat is assistant-backed. There is no clinician on the other end.
- Local history is lost if the database cannot be opened and the in-memory fallback is
  used for that session.

---

## Disclaimer

PulsePoint is **not a medical device** and gives no medical advice. It is a decision-support
prototype. If you are worried about a symptom, contact a health professional or your local
emergency number.

## Licence

Released under the MIT Licence. OpenStreetMap data via the Overpass API is
© OpenStreetMap contributors, available under the Open Database Licence.
