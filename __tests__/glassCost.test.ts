/**
 * Liquid glass is chrome material, not list material.
 *
 * ── The bug this pins ────────────────────────────────────────────────────────
 *
 * Switching from Home to Symptoms flickered and lagged, and so did the
 * navigation bar. Nothing was wrong with either the transition or the bar.
 *
 * The symptom list rendered all thirty-three of its rows as glass Cards, and
 * each glass Card is a LiquidGlass: a live Android blur sampling the view
 * hierarchy behind it every frame, plus an SVG carrying a gradient sheen and
 * a circle-pattern grain. Each also renders twice, because LiquidGlass has to
 * measure itself before it can draw. So opening the tab meant standing up
 * thirty-three live blurs and thirty-three SVGs in one paint.
 *
 * The reason it showed up in the navigation bar is worth remembering: the
 * sliding pill runs on the JS driver - deliberately, because a natively
 * driven value is lost when Android re-attaches the view - so a first paint
 * that expensive starves the thread the pill animates on. A slow screen and a
 * stuttering bar were the same bug.
 *
 * A count is a crude measure, and it is the right one here: the failure is
 * not that any single glass surface is wrong, it is that they multiply. Two
 * or three per screen is what the material is for.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SCREENS = join(__dirname, '..', 'src', 'ui', 'screens');

/**
 * Past this, glass has stopped being chrome and started being content.
 *
 * The screens that use it most carry four or five - a header, a hero, a
 * couple of result cards. Thirty-three is what the bug looked like.
 */
const BUDGET = 8;

const files = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'));
const read = (f: string) => readFileSync(join(SCREENS, f), 'utf8');

const glassCount = (source: string) => (
  (source.match(/glass=\{true\}/g) ?? []).length
  + (source.match(/<LiquidGlass/g) ?? []).length
);

describe('the cost of glass', () => {
  it.each(files)('%s stays within the glass budget', (file) => {
    expect(glassCount(read(file))).toBeLessThanOrEqual(BUDGET);
  });

  it('does not put glass on the symptom rows', () => {
    /*
     * Named directly, because a count alone would let this back in as soon as
     * the catalogue shrank. The rows are a repeated list: whatever their
     * number, they are not chrome.
     */
    const source = read('TriageScreen.tsx');
    const list = /CATALOGUE\.map\(([\s\S]*?)\n          \}\)\}/.exec(source)?.[1];

    expect(list).toBeDefined();
    // The prop, not the word - the block carries a comment explaining why the
    // prop is absent, and that comment is the point of keeping it.
    expect(list).not.toMatch(/glass=\{true\}/);
    expect(list).not.toContain('<LiquidGlass');
  });

  it('counts something, so the budget cannot pass vacuously', () => {
    // If the pattern stopped matching, every screen would score zero and the
    // budget would hold for the wrong reason.
    const total = files.reduce((n, f) => n + glassCount(read(f)), 0);
    expect(total).toBeGreaterThan(0);
  });
});
