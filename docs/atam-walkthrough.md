# ATAM scenario walkthrough against QR1 to QR7

PulsePoint, Milestone 2. Jaydev Patel, developer role. Walkthrough run 21 October 2026
against revision 5a8fa2b.

This is a single-evaluator desk walkthrough, not a full ATAM. A real ATAM seats the
architect, the stakeholders and an independent evaluation team in a room over two phases.
Working alone, I can supply the scenarios, the architectural approaches and the analysis,
but I cannot supply stakeholder elicitation or independent challenge. Every risk below was
found by reading the source, so the method shares the blind spot recorded in the report:
it cannot see runtime or device behaviour.

## Quality requirements carried forward from Milestone 1

| ID | Requirement |
|---|---|
| QR1 | A result within 500 ms at the 95th percentile |
| QR2 | Slow or failed calls are reported, never left blank |
| QR3 | Health data encrypted at rest, keys hardware-backed, one enforced encryption point |
| QR4 | The classifier is replaceable; the domain imports nothing platform-specific |
| QR5 | Red-flag escalation cannot be outranked and is visible without scrolling |
| QR6 | Contrast and touch targets meet WCAG 2.2 AA; any primary task within four taps |
| QR7 | Install size under 150 MB with datasets |

## Scenarios and analysis

### S1. A user with stroke symptoms opens the app and needs a band (QR1, QR5)

**Approach.** `AssessSymptomsUseCase` runs seven red-flag rules first, then a saturating
noisy-OR classifier, then combines the two so the band can only rise.

**Analysis.** Rule evaluation plus the SQLite write measured 77 to 91 ms earlier in the
project, inside QR1. Three tests lock the escalate-only combination: a red flag escalates
even when the classifier returns 1/100, low confidence cannot suppress an escalation, and
a high score is never pulled down.

**Non-risk.** QR5 holds at the source level, and it holds because the ordering is
structural rather than conventional.

**Risk R1.** QR1 is met by the local band but not by what the user waits for. The backend
analysis holds the result screen for about 12 seconds. The requirement was written when
analysis was on-device, and the 4 September scope change moved it to the hosted API without
restating the number. QR1 as written is now measured against the wrong thing.

### S2. The network drops midway through an analysis (QR2)

**Approach.** `RemoteOutcome` carries five explicit states and `REMOTE_NOTICE` maps each
non-OK state to wording the screen shows.

**Analysis.** `faultInjection.test.ts` drives HTTP 500, 503, 401, an HTML error body and a
dropped link. The local band is computed and displayed before the remote call is attempted,
so a failure costs the user nothing.

**Non-risk.** QR2 holds, and it is the clearest case in the system of a requirement that
survived contact with the implementation unchanged.

### S3. The device is lost and the database is pulled off it (QR3)

**Approach.** SQLCipher through the expo-sqlite plugin, `PRAGMA key`, key in the Android
keystore via expo-secure-store.

**Risk R2.** QR3 is verified at configuration level only. Nothing has attempted to open the
file off the device with the wrong key, which is the only test that would settle it. The
report records this as Priority 2.

**Sensitivity point.** A build that cannot open an existing file with the stored key
recreates it. That protects availability and destroys history. The behaviour is correct for
a prototype and wrong for a product holding records a user cares about.

### S4. The rule classifier is replaced with a model (QR4)

**Approach.** The classifier sits behind a domain-owned port. `check-domain-boundaries.js`
fails the build on a forbidden import.

**Analysis.** The claim was exercised for real: the episode store moved from memory to
SQLite and later to SQLCipher without touching a screen.

**Non-risk.** QR4 holds for the store.

**Sensitivity point.** The boundary script scans direct domain-file imports, not transitive
ones. A forbidden dependency reached through an intermediate module would pass.

### S5. Two medicines are checked and the result contradicts itself (QR5)

**Approach.** The screen renders the backend verdict, risk level, markers and advice.

**Risk R3.** QR5 was specified for triage and never generalised. The interaction screen
rendered four model fields without checking they agree, so Dolo 650 with aspirin read
Generally Safe at RISK: LOW beside advice to avoid taking both. The same escalate-only
principle that protects the triage band did not protect the interaction verdict until
`reconcileMedicineCheck` was added. A requirement that names one screen leaves every
analogous screen unprotected.

### S6. A user reads the treatment list on the result screen (QR6)

**Approach.** Theme tokens drive colour; `contrast-audit.js` checks 84 pairs in both
schemes.

**Analysis.** All 84 pass. The SUS round's weakest item was Q8, cumbersome, where one
participant gave 3 while scoring 1 elsewhere, and the heuristic review found Result stacks
eight cards into one scroll.

**Risk R4.** The contrast half of QR6 is automated and passes. The reachability half, four
taps to any primary task, has never been measured, and touch target sizes are computed from
tokens rather than sampled from a rendered screen. The treatment disclaimer sits last in its
card, below three lists, so the reader most at risk reaches it last.

### S7. The offline facility dataset is added back (QR7)

**Approach.** Overpass is queried live rather than bundling a dataset.

**Analysis.** The release APK measures 140,699,154 bytes and occupies 146 MB installed,
against a 150 MB cap.

**Risk R5 and the main tradeoff point.** QR7 has about 4 MB of headroom. Bundling a facility
dataset or a quantised on-device model cannot fit. Milestone 1 raised the install budget
from 120 MB to 150 MB to make room for the interaction table and a facility dataset, which
treats size as a number to adjust rather than as a constraint pulling against QR1. Read as
a tradeoff, QR7 and QR1 as originally written cannot both be satisfied inside 150 MB, so
the 4 September decision to drop offline operation and on-device inference was a budget
decision as much as a schedule one.

## Summary

| ID | Risk | Quality attribute | Where the report covers it |
|---|---|---|---|
| R1 | QR1 measures local scoring, not the 12 s wait the user experiences | Performance | 4.3 |
| R2 | Encryption unproven off the device | Security | 4.3, 5.2, 5.3 Priority 2 |
| R3 | Escalate-only specified for triage only, not for interactions | Safety | 2.4, 4.4 |
| R4 | Reachability and touch targets unmeasured; disclaimer placed last | Usability | 4.3, 4.5 |
| R5 | QR7 has 4 MB headroom; offline data and on-device models cannot fit | Modifiability | 3.6, 5.3 |

| Non-risks | Why |
|---|---|
| Escalate-only triage combination | Structural, and locked by three tests |
| Visible failure reporting | Five explicit states, fault injection tested |
| Replaceable store behind a port | Demonstrated by two real substitutions |

**Tradeoff points.** QR7 against QR1 and offline capability (R5). Availability against
durability in the database recreate path (S3).

**Sensitivity points.** The boundary script's direct-import-only scan (S4). The database
recreate-on-failure behaviour (S3).

The most useful outcome is R5. The install budget, not the schedule, is what made offline
operation and on-device inference unaffordable, and no Milestone 1 document says so.
