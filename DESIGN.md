# PulsePoint Mobile — design system

## Direction

The web app is dark, neon and glassmorphic, with names like "Neural Collision Matrix".
For someone anxious about their health at 2am, that is decoration competing with legibility.

The app goes the other way: **light, high-contrast, plainly worded, fast**. That is not a
taste preference — it is what QR6 (WCAG 2.2 AA, 44 pt targets) and the cognitive-load
attribute of PACMAD (§5.3 of the report) actually require.

| | Web | Mobile |
|---|---|---|
| Surface | Dark, glassmorphic, 3D | Light, flat, opaque |
| Language | "Neural Diagnostic Matrix" | "How are you feeling?" |
| Output | 5 conditions + named drugs + homeopathy | One band, one score, one action |
| Motion | Heavy | Almost none |
| Colour | Decorative neon | Only the four severity bands |

## No landing page

The app opens on **Triage**. The first screen is the task — there is no marketing page,
no splash, no onboarding gate. This is a learnability decision (§5.3): time-to-first-result
is the metric that matters.

## The severity spine

Four stacked segments, filled up to the band. It appears on the result, on every history
row and on every facility card, so the same shape always carries the same meaning.

It works without colour vision (segment count), without reading a number, and at a glance.
`SeveritySpine` is the only component allowed to use the band colours.

## Navigation — five tabs

```
Triage (default) · Medicines · Care · Records · More
```

Each tab is a task, not a category. Secondary surfaces (check-in, documents, news, chat,
account) sit one push deep under More. Android hardware back maps onto the same stack.

Tap counts, checked by counting transitions rather than clicking:

| Task | Taps |
|---|---|
| Symptom check → result | 3 |
| Result → care near me | 4 |
| Emergency escalation from a result | 2 |

## Accounts: the rule that matters

**The account gates sync, not access.**

Triage, red-flag alerts and the medicine check work signed out and offline. Signing in only
buys history sync across devices. A login wall would break QR2 and would put a signup form
in front of a worried person. The web app gates everything behind Clerk; this deliberately
does not.

## Tokens

Defined once in `src/ui/theme.ts`. Nothing hardcodes a colour or a size.

- Palette: `C` — one accent (`#0B5FFF`), four band colours, five greys
- Spacing: `S` — 4 pt base
- Type: `T` — 32 / 22 / 16 / 14 / 12.5
- `TOUCH = 44` — every interactive element derives its minimum size from this constant

## Speed

- No icon font, no SVG library — the five tab glyphs are plain `View`s
- No animation library, no 3D, no gradients
- `FlatList` virtualisation on history
- The heavy work (inference) is off the UI thread

## Files

```
src/ui/
  theme.ts                  tokens
  App.tsx                   shell, navigation stack, dependency wiring
  nav/routes.ts             the navigation graph as typed data
  nav/TabBar.tsx            tabs + glyphs
  components/               SeveritySpine, Primitives, ScreenHeader, OfflineBanner
  screens/                  Triage, Result, Medicines, Care, Records, More, Auth, Simple
```

Dependency wiring lives only in `App.tsx`. Phase 7 swaps `RuleClassifier` for the TFLite
classifier by changing one line there.
