# PulsePoint Mobile

COMP826 Mobile Systems Development - Milestone 2 build.
Offline-first symptom triage and care navigation.

## Quick start

```powershell
npm install
npx expo prebuild --platform android   # generates the native android/ project
npm test                               # domain tests - plain Node, no emulator
```

Then **File → Open → `PulsePointApp/android`** in Android Studio and press **Run ▶**.

> `android/` is generated, not committed. That is deliberate and standard: it is
> machine-specific and fully reproducible from `app.json`. Regenerate any time with
> `npx expo prebuild --platform android --clean`.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Domain + safety tests. No emulator, no device. |
| `npm run typecheck` | `tsc --noEmit`, strict mode |
| `npm run lint:boundaries` | Evaluation criterion **E3** - fails if the domain layer imports React, React Native, Expo, SQLite or any network client |
| `npm run android` | Build and launch on a connected device/emulator |
| `npm run prebuild:clean` | Regenerate `android/` from scratch |

## Dependency security

`npm audit` reports 20 findings. They trace back to **two** upstream packages, and
neither reaches the shipped APK - Metro only bundles what the app actually imports,
and none of these are imported by app code.

| Package | Severity | Where it lives | Status |
|---|---|---|---|
| `postcss` | high + moderate | `@expo/metro-config`, build time | **Fixed** - pinned to `^8.5.26` via `overrides` |
| `image-size` | high | `metro` bundler, build time | **No fix exists.** Latest published version (2.0.2) is still within the vulnerable range. Denial-of-service in ICNS/JXL parsers, reachable only by feeding hostile image files to the bundler at build time. |
| `uuid` | moderate | `xcode`, iOS project generation | **Not overridden on purpose.** `xcode` requires `uuid@^7`; forcing `uuid@11` breaks it. It runs only during iOS prebuild. |

Do not run `npm audit fix --force`. It ignores Expo's version pinning and will break
the SDK. Re-check with `npm run audit` after each SDK upgrade - the SDK 52 → 54 move
alone took this from 31 findings (1 critical) down to 20.

## Architecture

Clean Architecture with a strict inward dependency rule.

```
src/domain/     ← imports NOTHING platform-specific. Enforced by npm run lint:boundaries.
  entities.ts        types + invariants (TriageBand, TriageResult, requiresEscalation)
  redFlags.ts        FR3/QR5 safety rules - run before scoring, never suppressed
  ports.ts           Classifier, EpisodeStore interfaces (requirement L1)
  assessSymptoms.ts  the use case: red flags → classify → combine, escalate-only

src/data/       ← implements the domain's interfaces
  ruleClassifier.ts    Phase 1 noisy-OR engine; swapped for TFLite in Phase 4
  memoryStore.ts       Phase 1 store; swapped for SQLCipher in Phase 2
  symptomCatalogue.ts

src/ui/         ← stateless views, no business rules
  TriageScreen.tsx, ResultCard.tsx, theme.ts

scripts/check-domain-boundaries.js   ← criterion E3, runs in CI
```

**Why this shape:** in Phase 4 the TensorFlow Lite model replaces `RuleClassifier` by
implementing the same `Classifier` interface. Nothing above the data layer changes.
That is evaluation criterion **E5**, and there is a test asserting it.

## Safety design (FR3 / QR5)

`AssessSymptomsUseCase` runs in a fixed order, and the order is the point:

1. **Red-flag rules first.** Deterministic, readable, reviewable line by line.
2. **Then** the classifier scores the episode.
3. **Combine so the result can only escalate, never de-escalate.**

Three tests lock this in: a red flag escalates even when the classifier returns 1/100;
low confidence cannot suppress an escalation; and a high score is never pulled down.

## Scoring model

The classifier uses a **saturating (noisy-OR) aggregate**, not a linear sum. A linear
sum is wrong here - it is unbounded, so it cannot map onto the 0–100 band thresholds
without arbitrary rescaling, and it lets many trivial symptoms out-vote one serious
symptom. Current calibration:

| Presentation | Severity | Band |
|---|---|---|
| Mild sore throat | 6 | Self-care |
| Flu-like, 3 days | 48 | Pharmacy/GP |
| Child, fever + vomiting | 56 | Urgent |
| Chest pain + breathlessness + radiating pain | 89 | Emergency (red flag) |

## Phases

| Phase | Scope | Status |
|---|---|---|
| 1 | Skeleton, domain layer, triage engine, red flags, UI, tests | **Done** |
| 2 | `expo-sqlite` + SQLCipher persistence, episode history (FR5, QR3) | Next |
| 3 | Location, cached facility dataset, care map (FR4) | |
| 4 | Quantised TFLite classifier + QR1 benchmark in Studio's profiler | |
| 5 | Sync queue, connectivity worker, idempotent reconciliation (FR6) | |
| 6 | Document import + on-device extraction (FR7) | |
| 7 | Detox/Maestro suites, SUS study, 45-vignette audit | |

## Safety note

The red-flag rules in `src/domain/redFlags.ts` are **placeholders**. Before Milestone 2
each rule must be traced to citable published triage guidance. This is a prototype for
academic assessment and is not a medical device.
