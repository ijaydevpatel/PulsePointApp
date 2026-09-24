/**
 * A gate for the native-driver reveal bug.
 *
 * `useNativeDriver: true` hands the value to the UI thread, and the UI thread
 * never writes the final value back to JavaScript. So a component that
 * animates 0 → 1 natively still holds 0 on the JS side, and the next
 * re-render re-applies it — the content disappears, permanently, because the
 * effect that started the animation has already run.
 *
 * This shipped six times: Enter, TabTransition, Rise, the Continue button on
 * the symptom screen, the selected tab's label, and both press springs. It was
 * reported as three separate faults ("it disappears when I type", "it
 * disappears when I scroll", "the tab name flickers") and diagnosed twice
 * before the shared cause was found.
 *
 * `useReveal` is the one correct implementation. This test exists so the
 * pattern cannot come back by being written from scratch a seventh time: any
 * file that drives an animation natively has to go through the hook.
 *
 * A non-native animation (useNativeDriver: false) is not affected — it runs on
 * the JS side, so its value is never out of sync — and is not covered here.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const UI = join(__dirname, '..', 'src', 'ui');
const HOOK = 'useReveal.ts';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx?$/.test(name) && name !== HOOK ? [full] : [];
  });
}

describe('native-driven animation', () => {
  const files = sources(UI);

  it('finds UI sources to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [f.slice(UI.length + 1), f]))(
    '%s drives no animation natively outside useReveal',
    (_name, path) => {
      const src = readFileSync(path as string, 'utf8');
      if (!src.includes('useNativeDriver: true')) return;

      // Native driver present, so the hook has to be the thing driving it.
      expect(src).toContain("from '../useReveal'");

      /*
       * And no value may be created by hand alongside it. The import alone is
       * not enough — a file can use the hook in one place and hand-roll a
       * second value that has the bug.
       */
      expect(src).not.toContain('new Animated.Value');
    },
  );
});
