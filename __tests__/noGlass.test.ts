/**
 * Liquid glass is gone, and stays gone.
 *
 * ── Why it went ──────────────────────────────────────────────────────────────
 *
 * Each glass surface was a live Android blur sampling the view hierarchy
 * behind it every frame, plus an SVG carrying a gradient sheen and a
 * circle-pattern grain, rendered twice because it had to measure itself
 * before it could draw. Thirty-three of them on the Symptoms tab made the
 * screen stutter and, because the navigation pill animates on the JS driver,
 * made the bar stutter with it.
 *
 * It was reduced to a budget first. That kept the cost down without settling
 * the question, and the answer turned out to be simpler: the app is
 * minimalist, so the surface is a plain card with a hairline border and a
 * shadow. Nothing to measure, nothing to sample, nothing to starve.
 *
 * This file is the record of that decision. Deleting the component is not
 * enough on its own - someone can always write another one.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const UI = join(__dirname, '..', 'src', 'ui');

/** Every .tsx under src/ui, at any depth. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return sources(full);
    return e.name.endsWith('.tsx') || e.name.endsWith('.ts') ? [full] : [];
  });
}

const files = sources(UI);
const read = (f: string) => readFileSync(f, 'utf8');

/** Comments are history worth keeping; code is not. */
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('no liquid glass', () => {
  it('reads the whole of src/ui, so this cannot pass vacuously', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it('has no LiquidGlass component to import', () => {
    expect(existsSync(join(UI, 'components', 'LiquidGlass.tsx'))).toBe(false);
  });

  it.each(files.map((f) => [f.slice(UI.length + 1), f] as const))(
    '%s uses no glass surface',
    (_name, full) => {
      const code = stripComments(read(full));

      expect(code).not.toMatch(/<LiquidGlass\b/);
      expect(code).not.toMatch(/<GlassCircle\b/);
      expect(code).not.toMatch(/<GlassBackground\b/);
      expect(code).not.toMatch(/glass=\{true\}/);
      expect(code).not.toMatch(/tone="glass"/);
    },
  );

  it('does not reach for expo-blur again', () => {
    /*
     * The blur itself, not just the wrapper around it. expo-blur is still a
     * dependency and nothing stops a new screen importing it directly, which
     * would bring the cost back without bringing the component back.
     */
    for (const f of files) {
      expect(stripComments(read(f))).not.toContain('expo-blur');
    }
  });
});
