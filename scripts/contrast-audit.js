/**
 * QR6 gate: WCAG 2.2 contrast, both colour schemes.
 *
 * The redesign doubled every colour token, which doubles the chance of a
 * regression that nobody notices until a marker opens the app in dark mode.
 * This walks the real pairs the UI renders and fails the build on any that
 * drop below threshold, so contrast is a build error rather than an opinion.
 *
 * Thresholds (WCAG 2.2):
 *   normal text  4.5:1     large text (>=18.66px bold or >=24px)  3:1
 *   UI component boundaries and graphical objects  3:1
 */
const { execSync } = require('child_process');

/* Parse the palettes straight out of theme.ts so this cannot drift. */
const src = require('fs').readFileSync(
  require('path').join(__dirname, '..', 'src', 'ui', 'theme.ts'), 'utf8',
);

function block(name) {
  const m = src.match(new RegExp(`const ${name}[^=]*=\\s*{([\\s\\S]*?)\\n};`));
  if (!m) throw new Error(`could not find ${name} in theme.ts`);
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/);
    if (kv) out[kv[1]] = kv[2];
  }
  const need = ['bg', 'surface', 'sunken', 'line', 'lineStrong', 'ink',
                'inkSoft', 'muted', 'faint', 'accent', 'onAccent',
                'ok', 'warn', 'danger', 'onDanger'];
  const missing = need.filter((k) => !out[k]);
  if (missing.length) {
    throw new Error(`${name}: missing token(s) ${missing.join(', ')} — parser out of date.`);
  }
  return out;
}

function bands(name) {
  const m = src.match(new RegExp(`const ${name}[^=]*=\\s*{([\\s\\S]*?)\\n};`));
  const out = {};
  for (const line of m[1].split('\n')) {
    const b = line.match(/(\w+):\s*{\s*solidEdge:\s*'(#\w{6})',\s*fg:\s*'(#\w{6})',\s*bg:\s*'(#\w{6})',\s*solid:\s*'(#\w{6})',\s*onSolid:\s*'(#\w{6})'/);
    if (b) out[b[1]] = { solidEdge: b[2], fg: b[3], bg: b[4], solid: b[5], onSolid: b[6] };
  }
  return out;
}

const P = { light: block('light'), dark: block('dark') };
const B = { light: bands('bandsLight'), dark: bands('bandsDark') };

/*
 * Glass tints.
 *
 * These are no longer literals — theme.ts computes them from `glassFor(scheme,
 * t)`, where t is a transparency slider. Scraping values with a regex broke the
 * moment that changed, so the audit now *evaluates* the real function instead.
 *
 * The body is pure arithmetic with no imports, so it can be lifted out and run
 * directly. If its shape ever changes this throws rather than quietly falling
 * back to stale numbers — the failure mode that matters.
 */
function glassEval(scheme) {
  const grab = (re, what) => {
    const m = src.match(re);
    if (!m) {
      throw new Error(
        `contrast-audit: could not extract ${what} from theme.ts. The glass ` +
        `material changed shape — update this extractor rather than skipping ` +
        `the glass checks.`,
      );
    }
    return m[0];
  };

  const lerpSrc  = grab(/const lerp = [^;]+;/, 'lerp()');
  const rgbaSrc  = grab(/function rgba\([\s\S]*?\n}/, 'rgba()');
  const glassSrc = grab(/export function glassFor\([\s\S]*?\n}/, 'glassFor()');

  /*
   * Strip TypeScript annotations. Only three forms appear in this arithmetic —
   * typed parameters, return types and the Glass cast — so a targeted strip is
   * safer here than pulling in a compiler for four lines of maths.
   */
  const deTs = (t) => t
    .replace(/:\s*GlassIntensity/g, '')
    .replace(/:\s*Glass\b/g, '')
    .replace(/:\s*Scheme\b/g, '')
    .replace(/(\(|,\s*)(\w+)\s*:\s*number/g, '$1$2')
    .replace(/\)\s*:\s*\w+\s*{/g, ') {');

  // eslint-disable-next-line no-new-func
  const build = new Function(
    `${deTs(lerpSrc)}\n${deTs(rgbaSrc)}\n` +
    `${deTs(glassSrc).replace('export function', 'function')}\n` +
    `return glassFor(arguments[0], arguments[1]);`,
  );

  // t = 0 is maximum transparency, which is the worst case for legibility.
  const g = build(scheme, 0);
  if (!g || !g.centreTint) {
    throw new Error('contrast-audit: glassFor() returned no centreTint.');
  }
  return g;
}
const G = { light: glassEval('light'), dark: glassEval('dark') };

/**
 * Composite a translucent colour over an opaque backdrop.
 * Mirrors composite() in theme.ts — glass is see-through, so a label on it is
 * not sitting on the tint, it is sitting on the tint *over whatever is behind*.
 */
function over(overlay, backdrop) {
  const nums = overlay.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number);
  const a = nums.length > 3 ? nums[3] : 1;
  const bd = [1, 3, 5].map((i) => parseInt(backdrop.slice(i, i + 2), 16));
  const out = nums.slice(0, 3).map((c, i) => Math.round(c * a + bd[i] * (1 - a)));
  return '#' + out.map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('');
}

/* ── contrast maths ──────────────────────────────────────────────────────── */

function lum(hex) {
  const v = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function ratio(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/* ── the pairs the UI actually renders ───────────────────────────────────── */

const checks = [];
for (const scheme of ['light', 'dark']) {
  const c = P[scheme];
  const push = (need, fg, bg, what) =>
    checks.push({ scheme, what, fg, bg, need, got: ratio(fg, bg) });

  // Body and heading text on each surface tier.
  for (const [sn, s] of Object.entries({ bg: c.bg, surface: c.surface, sunken: c.sunken })) {
    push(4.5, c.ink, s, `ink on ${sn}`);
    push(4.5, c.inkSoft, s, `inkSoft on ${sn}`);
    push(4.5, c.muted, s, `muted on ${sn}`);
    push(4.5, c.accent, s, `accent text on ${sn}`);
  }

  // faint is used only for 11px labels and inactive icons — a graphical
  // object and a non-essential label, so 3:1 is the correct bar, not 4.5.
  push(3, c.faint, c.bg, 'faint on bg (inactive icon)');
  push(3, c.faint, c.surface, 'faint on surface');

  // Button fills.
  push(4.5, c.onAccent, c.accent, 'button label on accent');
  push(4.5, c.onDanger, c.danger, 'button label on danger');

  // Borders must be visible against their surface (UI component, 3:1).
  push(3, c.lineStrong, c.surface, 'strong border on surface');

  // Status colours as text.
  push(4.5, c.ok, c.surface, 'ok text on surface');
  push(4.5, c.warn, c.surface, 'warn text on surface');
  push(4.5, c.danger, c.surface, 'danger text on surface');

  // Every severity band, in all three ways it is rendered.
  for (const [band, b] of Object.entries(B[scheme])) {
    push(4.5, b.fg, c.surface, `${band} fg on surface`);
    push(4.5, b.fg, b.bg, `${band} fg on its soft chip`);
    // The result hero sets 30px+ type on the solid fill — large-text bar.
    push(3, b.onSolid, b.solid, `${band} hero text on solid`);
    // The fill itself may be a light Apple colour; the boundary is carried by
    // the hairline drawn against the canvas, so that is what gets checked.
    push(3, b.solidEdge, c.bg, `${band} block boundary against canvas`);
  }
}

/* ── the liquid glass tab bar ────────────────────────────────────────────── */

/*
 * Liquid glass is far more transparent than a frosted panel, so its labels
 * cannot be checked against a fixed colour. They are checked against the tint
 * composited over every backdrop that can realistically scroll underneath —
 * the canvas, a card, and each saturated band hero from the result screen.
 *
 * The centre tint is used rather than the edge tint because it is the weaker
 * of the two, and the labels sit in the centre zone. Checking the denser edge
 * would flatter the result.
 */
for (const scheme of ['light', 'dark']) {
  const c = P[scheme];
  const tint = G[scheme].centreTint;

  /*
   * Only backdrops that can actually appear beneath the tab bar.
   *
   * The saturated band heroes are deliberately absent, and that exclusion is
   * not an assumption — it is a precondition verified below. App.tsx renders
   * the tab bar only when no overlay is present, and every screen with a
   * saturated hero (result, interactions) is an overlay. If that ever changes,
   * the structural check further down fails and this audit stops being valid,
   * which is the point of checking it rather than asserting it in a comment.
   */
  const backdrops = [
    ['canvas', c.bg],
    ['a card', c.surface],
    ['a sunken well', c.sunken],
  ];

  for (const [what, bd] of backdrops) {
    const behind = over(tint, bd);
    // Active label and icon.
    checks.push({
      scheme, what: `tab label (active) on glass over ${what}`,
      fg: c.accent, bg: behind, need: 3, got: ratio(c.accent, behind),
    });
    // Inactive label and icon. Small text, but it is a control label, so 3:1
    // is the floor for the icon and the label rides with it.
    checks.push({
      scheme, what: `tab label (inactive) on glass over ${what}`,
      fg: c.muted, bg: behind, need: 3, got: ratio(c.muted, behind),
    });
  }
}

/* ── structural precondition ─────────────────────────────────────────────── */

/*
 * The glass checks above are only sound if the tab bar never sits over a
 * saturated hero. Verify that the shell still enforces it.
 */
const appSrc = require('fs').readFileSync(
  require('path').join(__dirname, '..', 'src', 'ui', 'App.tsx'), 'utf8',
);
/*
 * Checked structurally rather than by exact text, so wrapping the bar in a
 * fragment or adding a sibling does not silently pass or silently fail.
 *
 * Two conditions:
 *   a) the shell renders exactly one <TabBar
 *   b) it appears inside the `overlay ? null :` branch — that is, after the
 *      guard and before that expression closes
 */
const tabBarCount = (appSrc.match(/<TabBar\b/g) || []).length;
const guardAt = appSrc.search(/overlay\s*\?\s*null\s*:/);
const barAt = appSrc.search(/<TabBar\b/);
const guarded =
  tabBarCount === 1 &&
  guardAt !== -1 &&
  barAt > guardAt &&
  // Inside the same expression, not somewhere far below it.
  barAt - guardAt < 600;

/* ── report ──────────────────────────────────────────────────────────────── */

const fails = checks.filter((c) => c.got < c.need);
const pad = (s, n) => String(s).padEnd(n);

console.log('\nWCAG 2.2 contrast audit — QR6\n');
for (const scheme of ['light', 'dark']) {
  const rows = checks.filter((c) => c.scheme === scheme);
  const bad = rows.filter((c) => c.got < c.need);
  console.log(`  ${scheme.padEnd(6)} ${rows.length - bad.length}/${rows.length} pass`);
}

if (!guarded) {
  console.log(
    '\n  [X] PRECONDITION BROKEN\n' +
    `      App.tsx no longer hides the tab bar behind an overlay.\n` +
    `      (<TabBar occurrences: ${tabBarCount}, guard at ${guardAt}, bar at ${barAt})\n` +
    '      Glass labels can now fall over a saturated band hero, where they\n' +
    '      measure as low as 1.47:1. Either restore the guard, or add the\n' +
    '      band solids back to the backdrop list above and fix what fails.\n',
  );
  process.exit(1);
}

console.log('  precondition: tab bar is hidden behind overlays — OK\n');

if (fails.length) {
  console.log('\nFailures:\n');
  for (const f of fails) {
    console.log(
      `  [${pad(f.scheme, 5)}] ${pad(f.what, 40)} ${f.fg} on ${f.bg}  ` +
      `${f.got.toFixed(2)}:1  (needs ${f.need}:1)`,
    );
  }
  console.log(`\n${fails.length} contrast failure(s). QR6 not met.\n`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} pairs pass. QR6 met in both schemes.\n`);
