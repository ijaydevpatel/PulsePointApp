/**
 * A gate for the vanishing-content bug.
 *
 * `useNativeDriver: true` moves an animated value out of the React tree into a
 * native animated node, which writes the style straight onto the view. React
 * holds no prop for it. So when Android detaches and re-attaches that view -
 * scrolling, a keyboard-driven relayout, a tab change - the value is simply
 * gone, and an opacity that started at 0 stays at 0. The content is not there,
 * and nothing short of a remount brings it back, which is why re-pressing the
 * tab worked.
 *
 * This was reported four times and misdiagnosed twice as a re-render problem.
 * It cannot have been one: there is no onScroll handler anywhere in this
 * codebase, so scrolling causes no re-render at all. That fact is what ruled
 * the earlier explanation out.
 *
 * The rule enforced here: all animation goes through `useReveal`, which
 * defaults to the JS driver so values reach the view as ordinary style props -
 * meaning a re-created view is handed the right opacity by the React tree, the
 * same way it is handed its colour - and which stops involving the animation
 * in visibility at all once it settles. Native driving stays available through
 * the hook for transform-only feedback, where a lost value leaves a control
 * slightly the wrong size rather than absent.
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

describe('animation', () => {
  const files = sources(UI);

  it('finds UI sources to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  /*
   * The hook object is a new reference whenever `finished` changes, so listing
   * it in a dependency array re-runs the effect, which restarts the animation,
   * which changes `finished` again. The tab bar flickered continuously on
   * exactly this: the entrance was starting over several times a second, and
   * with it five SVG icons were re-rendering.
   *
   * The functions the hook returns are stable. Depend on those.
   */
  it.each(files.map((f) => [f.slice(UI.length + 1), f]))(
    '%s keeps useReveal objects out of dependency arrays',
    (_name, path) => {
      const src = readFileSync(path as string, 'utf8');

      // Only whole-object bindings can be misused this way; a destructured
      // `const { play } = useReveal()` hands over stable functions.
      const bound = [...src.matchAll(/const\s+(\w+)\s*=\s*useReveal\(/g)].map((m) => m[1]);
      if (bound.length === 0) return;

      const deps = [...src.matchAll(/\}\s*,\s*\[([^\]]*)\]\s*\)/g)].map((m) => m[1]);

      for (const name of bound) {
        for (const list of deps) {
          expect(list).not.toMatch(new RegExp(`\\b${name}\\b`));
        }
      }
    },
  );

  it.each(files.map((f) => [f.slice(UI.length + 1), f]))(
    '%s animates only through useReveal',
    (_name, path) => {
      const src = readFileSync(path as string, 'utf8');

      /*
       * No file outside the hook picks the driver for itself. Written by hand
       * this reads as the obvious choice, and it is the setting that loses the
       * content.
       */
      expect(src).not.toMatch(/useNativeDriver:\s*true/);

      /*
       * That one assertion is the whole gate, and it is enough.
       *
       * React Native requires useNativeDriver to be stated explicitly on every
       * animation - it throws otherwise - so there is no way to hand-roll one
       * that silently picks the dangerous setting. An animation that declares
       * false keeps its value in the React tree and cannot lose it, which is
       * why useCountUp on the result screen is fine as written: it drives a
       * number into state rather than driving visibility at all.
       */
    },
  );
});
