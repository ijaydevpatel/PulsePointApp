/**
 * Stacked cards need their own spacing.
 *
 * ── The bug this pins ────────────────────────────────────────────────────────
 *
 * NavCard carries no margin. Every screen that stacks them has always wrapped
 * each one in a spacer View - MoreScreen does it in two places - and that
 * convention lives nowhere except in the screens that happen to follow it.
 *
 * Profile and Settings were written without it, so six rows sat flush against
 * each other and against the Cards beneath them: no crash, no warning,
 * nothing to notice until someone looks at the screen and says the spacing is
 * "messed, some perfect, some overlapping".
 *
 * A convention a new screen cannot discover is one a new screen will break.
 * This test is where it is written down.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SCREENS = join(__dirname, '..', 'src', 'ui', 'screens');
const files = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'));
const read = (f: string) => readFileSync(join(SCREENS, f), 'utf8');

/** Every `<NavCard ... />` element, with the line that precedes it. */
function navCards(source: string): { before: string }[] {
  const lines = source.split('\n');
  const found: { before: string }[] = [];

  lines.forEach((line, i) => {
    if (!/^\s*<NavCard\b/.test(line)) return;
    found.push({ before: lines[i - 1] ?? '' });
  });

  return found;
}

describe('NavCard spacing', () => {
  it('finds the screens that stack navigation rows', () => {
    // Guards the test below against passing because the pattern stopped
    // matching anything at all.
    const total = files.reduce((n, f) => n + navCards(read(f)).length, 0);
    expect(total).toBeGreaterThanOrEqual(6);
  });

  it.each(files)('%s gives every NavCard a spacer', (file) => {
    /*
     * The wrapper is the convention: <View style={{ marginBottom: S.sm }}>.
     * Anything that sets a bottom margin on the line above counts - the point
     * is that the row is not left flush against the next one.
     */
    for (const { before } of navCards(read(file))) {
      expect(before).toMatch(/marginBottom/);
    }
  });
});
