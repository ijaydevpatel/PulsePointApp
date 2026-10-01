# PulsePoint source-based usability inspection

Date: 1 October 2026. Application source baseline: `5a8fa2b`. This inspection adapts Nielsen's ten heuristics to source paths for Triage, Result, Care and Records. It was conducted through code inspection, with AI assistance. It is not an independent human expert evaluation, a device walkthrough or a participant test. No finding below is claimed as a completed app fix.

The [heuristic definitions](https://www.nngroup.com/articles/ten-usability-heuristics/) and [evaluation procedure](https://www.nngroup.com/articles/how-to-conduct-a-heuristic-evaluation/) provide the method. The standard procedure includes reviewing the interface; source inspection is narrower and cannot settle visual or behavioural questions requiring interaction.

Tasks inspected: enter symptoms; read a result; select nearby care and directions; open/delete a record. The matrix contains 40 screen/heuristic checks. Numbers are provisional priority judgements: 0 no source-visible issue found; 1 cosmetic; 2 minor; 3 major; 4 release-blocking. NR means the source alone cannot justify a rating. A 0 is not proof that users encounter no problem.

| Heuristic | Triage | Result | Care | Records |
|---|---|---|---|---|
| H1 Status | Busy indicator present (0) | Non-escalated result waits up to 12 s even after local saving (2) | Busy/stale/empty notices present (0) | Loaded flag exists; rejected load has no visible catch path (2) |
| H2 Familiar language | Symptoms use catalogue labels; understanding needs user review (NR) | Band advice and confidence explanation present; comprehension untested (NR) | Facility/distance terms present; appropriateness untested (NR) | Subtitle says encrypted without verified build support (3) |
| H3 Control | Selected symptoms can be toggled; tab switching remains available (0) | Back and Find care handlers exist (0) | Sheet dismissal, filters and recenter controls exist (0) | Delete confirms, but no restore/undo path exists (2) |
| H4 Consistency | Shared components/theme imported (0) | Stored PENDING_SYNC text promises a later explanation without a history-sync worker (3) | Notices distinguish stale results (0) | Local/encrypted assurance omits fallback and remote-processing limits (3) |
| H5 Prevention | Free-text-only input permits submission; local episode contains no selected symptoms (3) | Red flags bypass the reveal wait (0); clinical safety is untested | Search fences outdated runs (0) | Destructive confirmation exists (0) |
| H6 Recognition | Selected count and symptom options visible in source (0) | Advice shown; general stored rationale not rendered (2) | Filter/facility lists exist; actual map legend recognition needs device review (NR) | Reported symptom labels shown in detail (0) |
| H7 Efficiency | Submission control appears when input is present (0) | Find care shortcut exists; delayed non-urgent reveal adds waiting (2) | Warm cache shown and refreshed (0) | Saved checks open without re-entry (0) |
| H8 Minimal design | Density and font scaling require rendered/device review (NR) | Several analysis sections exist; distraction cannot be rated from source (NR) | Map/list crowding cannot be judged from source (NR) | List/detail density requires rendered/device review (NR) |
| H9 Recovery | Assessment uses finally but no local user-facing catch path (2) | Remote failure notice branch exists (0) | Retry and empty/filter notices exist (0) | Load/remove errors have no visible recovery catch path (2) |
| H10 Help | No explicit pre-submit remote-processing disclosure found in this inspected screen (3) | Confidence help/disclaimer exist; future-sync wording needs correction (3) | Nearby-search/retry guidance exists (0) | Deletion text explains permanence; storage assurance needs correction (3) |

Evidence paths are relative to the repository: `src/ui/screens/TriageScreen.tsx` (canSubmit, assess, input controls); `ResultScreen.tsx` (reveal timer, escalation, confidence help, PENDING_SYNC text); `CareScreen.tsx` (load, stale notices, controls, Empty); `RecordsScreen.tsx` (load, remove, subtitle, detail). `src/data/episodeStore.ts`, `sqliteStore.ts`, `src/ui/App.tsx` and the Expo/native configuration establish the storage, routes and remote-processing limits.

Recommended backlog:

1. Verify encryption configuration and make storage/privacy text match the installed build.
2. Separate free-text remote analysis from the selected-symptom local rule path; do not imply both interpret identical inputs.
3. Show local non-urgent advice without waiting for remote completion, then add remote material separately.
4. Add recoverable error states for assessment and Records operations.
5. Replace the future-sync assurance unless an actual worker is delivered.
6. Test deletion recovery and disclosure wording with users before deciding whether confirmation alone is sufficient.

These findings need device confirmation. No participant score, measured task time or screen-reader outcome is inferred from source. The report should not call this a completed full usability evaluation.
