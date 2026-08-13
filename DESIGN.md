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

---

## Visual design system (added 13 Aug 2026)

The first build worked but looked like a wireframe. Four things caused that,
and each was fixed at the system level rather than screen by screen.

| Problem | Fix |
|---|---|
| System default font | Inter, six weights, bundled — no runtime download |
| No icons (tab bar was text) | 19 hand-drawn stroke icons on a 24px grid |
| No motion | Spring press feedback and staggered entrances everywhere |
| Flat surfaces | Four defined elevation steps, no ad-hoc shadows |

### Direction

Calm clinical foundation, editorial where it earns attention.

The web app is dark, neon and glassmorphic. For someone anxious at 2am that is
decoration competing with legibility, so the base is quiet and high contrast.
Expressiveness is spent in exactly one place — the result screen — because that
is the moment the app has something to say. The band colour fills the top of
the screen and the severity figure is set at 76pt.

That layout is also a safety fix. The web app buried a 42% meningitis reading
in the least prominent row of a table. Here the band decides the colour of the
screen, so under-weighting an urgent result is structurally impossible rather
than merely discouraged.

### Three rules the UI obeys

1. **Colour carries meaning.** The four severity colours never appear
   decoratively. Everything else is ink, surface, or the single accent.
2. **Every surface sits on a defined elevation step.** No ad-hoc shadows.
   Dark mode drops shadow opacity and gets depth from surface lightness
   instead, because a dark shadow on a dark canvas reads as mud.
3. **Every interactive element responds within 100ms**, by motion or haptic,
   before the state itself changes.

### Why motion, in assessment terms

Perceived performance is a PACMAD efficiency concern, not decoration. A control
that springs and fires a haptic on `onPressIn` acknowledges the touch on the
frame it happens, independent of how long the work behind it takes. The presses
use the native driver specifically so they survive a busy JS thread — which is
exactly when a laggy interface would otherwise be noticed.

The severity figure counts up rather than appearing. That communicates the value
was computed, and gives the eye a reason to land on the figure before the advice
below it.

### Dark mode

Every colour token is doubled and follows the OS setting, with a manual override
in More → Appearance. Both schemes are gated by `npm run contrast`, which parses
the palettes straight out of `theme.ts` and fails the build on any pair below
WCAG 2.2 AA. Currently **72/72 pairs pass in both schemes**.

That gate has already earned itself: it caught seven real failures on the first
run, including white button text on the lighter dark-mode red at 2.74:1. That
one is invisible in light mode and would not have been found by looking.

### Accessibility is unchanged by the redesign

Every control still meets the 44pt minimum through the single `TOUCH` constant.
Selection states carry three redundant cues — fill, border and weight — so they
do not depend on colour alone.

### What the redesign did not touch

`src/domain/` and `src/data/` are byte-identical. The 30 domain and safety
assertions were unaffected by a complete visual rewrite, which is the concrete
payoff of the dependency rule in §4.

---

## Liquid glass (added 14 Aug 2026)

The first attempt at this was glassmorphism, which is a different material, and
the difference is *where the distortion sits*.

| | Glassmorphism | Liquid glass |
|---|---|---|
| Surface | uniformly frosted | near-clear through the middle |
| Distortion | even across the panel | concentrated at the rim |
| Edge | a single flat border | lit top edge, bright lower inside face |
| Motion | static texture | deforms while travelling |

### How it is built, without a shader

`LiquidGlass` stacks five layers and the order is the trick:

1. heavy `BlurView` filling the shape
2. a denser tint over it
3. **an inset, separately-rounded view holding a much lighter blur** — this cuts
   a clear window through the middle and leaves the heavy blur showing only as
   a band around the rim
4. a bright hairline along the top where light enters, and a second bright edge
   along the bottom inside face where it exits
5. a short specular arc across the top-left

Layer 3 is what reads as refraction. The eye infers "content behind is being
bent here" from the *gradient* of blur across the surface, not from geometric
accuracy — so blurring the rim roughly 4× harder than the centre produces the
effect with no GPU shader and no extra native module. `react-native-svg` was
already in the tree for the icon set, so the light layers cost nothing new.

Layer 4 matters more than it sounds. One uniform border reads as a stroke round
a rectangle; two opposed lit edges read as a solid object with thickness.

**Honest limit:** this is a convincing approximation, not true per-pixel
refraction. Real lensing — where the content behind visibly warps and magnifies
at the rim — needs a fragment shader. `@shopify/react-native-skia` would provide
it, at the cost of a large native dependency and another full rebuild.

### The "liquid" part

The tab indicator stretches along its direction of travel and settles back. The
stretch is interpolated from *the same animated value* that drives translation,
so it cannot desynchronise — the deformation is literally a function of how far
the indicator still has to go.

This is not decoration. A rigid shape sliding across reads as a selection box;
one that elongates with its own momentum reads as a substance under tension. It
is the single cheapest change that makes the material feel physical.

### Shape language

Every icon-only control is a true circle via `circle(size)`, and every text
button is a capsule. Rounded squares read as Material; glass has no corners, so
neither do the controls beside it.

### Where glass is allowed — and where it is not

**Chrome only.** The tab bar, floating controls and back buttons. No clinical
text is ever set on glass.

Liquid glass is far more transparent than a frosted panel, which is exactly why
this restriction exists: a triage result must be legible over whatever happens
to be behind it, and glass cannot promise that.

Two places degrade deliberately. On the result and interaction heroes — flat
saturated fills — the back button falls back to a tinted circle, because glass
over a solid colour has nothing to refract and would read as a grey smudge.

### The contrast problem this created, and how it is gated

Glass is see-through, so a label on it is not sitting on the tint — it is
sitting on the tint *over whatever is behind*. `scripts/contrast-audit.js` now
composites the centre tint over every backdrop that can appear beneath the tab
bar and checks both label states against each.

It uses the *centre* tint rather than the denser edge tint, because the labels
sit in the centre zone and checking the denser layer would flatter the result.

Running it over the saturated band heroes produced 16 failures, as low as
1.47:1. Those backdrops are excluded — but not on an assumption. `App.tsx`
renders the tab bar only when no overlay is present, and every screen with a
saturated hero is an overlay. The audit **verifies that guard structurally** and
fails with an explicit message if it is ever removed, so the exclusion stops
being valid the moment the precondition does.

Currently **84/84 pairs pass in both schemes**, precondition holding.

### One bug this pass fixed

The primary button floats above a scrolling list and was dimming when disabled
by dropping opacity to 40%. The list scrolled visibly through it and the label
sat on whatever happened to be behind — legible one moment, not the next.

Disabled state now mutes the fill and text colours instead, keeping the control
opaque. Its contrast is therefore a fixed pair (`muted` on `sunken`) that the
audit already covers.
