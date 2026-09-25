/**
 * The map components CareScreen renders must exist in the installed package.
 *
 * This exists because of a crash that nothing else caught. The screen was
 * written against MapLibre v10's API - MapView, ShapeSource, CircleLayer -
 * and v11.4.0 renamed all three. The module imported fine, so the runtime
 * guard passed; every component was simply `undefined`, and React reported
 * it as "Element type is invalid ... got: undefined" from deep inside the
 * tree, on a screen that had shipped as working.
 *
 * tsc could not catch it either: the import is a deliberately dynamic
 * `require` so a missing native module degrades rather than failing the
 * bundle, and that makes the namespace `any`.
 *
 * So this reads the source rather than running it. Rendering a native map
 * under Jest would need the native module; the question here is only whether
 * the names line up, and that is answerable statically.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const SCREEN = join(__dirname, '..', 'src', 'ui', 'screens', 'CareScreen.tsx');
const PACKAGE = '@maplibre/maplibre-react-native';

/** Every `MapLibreGL.<Name>` the screen renders or reads. */
function usedNames(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(/MapLibreGL[?]?\.(\w+)/g)) {
    found.add(m[1]!);
  }
  return [...found].sort();
}

/**
 * What the installed package actually exports.
 *
 * Read from its CommonJS entry point, which declares each export with
 * Object.defineProperty, rather than by requiring it - requiring pulls in
 * react-native's native modules, which is not something a unit test should
 * need in order to answer a question about names.
 */
function exportedNames(): Set<string> {
  /*
   * Located by path rather than by require.resolve: the package declares an
   * "exports" map, which makes deep subpaths unresolvable even though the
   * file is plainly there.
   */
  const root = join(__dirname, '..', 'node_modules', ...PACKAGE.split('/'));
  const source = readFileSync(join(root, 'lib', 'commonjs', 'index.js'), 'utf8');

  const names = new Set<string>();
  for (const m of source.matchAll(/Object\.defineProperty\(exports,\s*"([^"]+)"/g)) {
    names.add(m[1]!);
  }
  for (const m of source.matchAll(/exports\.(\w+)\s*=/g)) {
    names.add(m[1]!);
  }

  names.delete('__esModule');
  return names;
}

describe('the MapLibre API the Map tab is written against', () => {
  const source = readFileSync(SCREEN, 'utf8');

  it('uses names the installed package exports', () => {
    const exported = exportedNames();
    const missing = usedNames(source).filter((n) => !exported.has(n));

    expect(missing).toEqual([]);
  });

  it('reads more than nothing, so the check cannot pass vacuously', () => {
    // A rename that removed every usage would otherwise make the test above
    // pass by having no names left to check.
    expect(usedNames(source).length).toBeGreaterThanOrEqual(4);
  });

  it('still guards on a component rather than on the module', () => {
    /*
     * `MapLibreGL != null` was the original guard and is what let the crash
     * through: the module was present and the components were not. The guard
     * has to name something it is about to render.
     */
    expect(source).toMatch(/MapLibreGL\?\.Map\b/);
  });

  it('does not reference the v10 names that were renamed', () => {
    for (const gone of ['MapView', 'ShapeSource', 'CircleLayer', 'setAccessToken']) {
      expect(source).not.toContain(`MapLibreGL.${gone}`);
    }
  });
});
