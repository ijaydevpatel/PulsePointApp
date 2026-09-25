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

  it('labels the pins with a font the style actually serves', () => {
    /*
     * MapLibre renders no text at all - no warning, no fallback - when a
     * symbol layer asks for a fontstack the style's glyph endpoint does not
     * have. The default is "Open Sans Regular", which this style does not
     * serve, so a symbol layer that omits text-font draws nothing and looks
     * like a layer that failed.
     *
     * https://tiles.openfreemap.org/styles/positron declares a glyphs
     * endpoint and uses exactly these three stacks.
     */
    const SERVED = ['Noto Sans Regular', 'Noto Sans Bold', 'Noto Sans Italic'];

    expect(source).toContain("type=\"symbol\"");

    const fonts = [...source.matchAll(/'text-font':\s*\[([^\]]*)\]/g)]
      .map((m) => m[1]!.replace(/['"]/g, '').trim());

    expect(fonts.length).toBeGreaterThan(0);
    for (const font of fonts) {
      expect(SERVED).toContain(font);
    }
  });

  it('marks the person by more than colour', () => {
    /*
     * A blue dot was not enough: every facility is a flat coloured disc too,
     * and two categories are already blue-ish. The own-position mark differs
     * in shape (concentric), size, and words.
     */
    expect(source).toContain('me-halo');
    expect(source).toContain('me-disc');
    expect(source).toContain('me-dot');
    expect(source).toContain('You are here');
  });

  it('never lets the "you are here" caption be dropped', () => {
    /*
     * MapLibre drops colliding labels, and on a crowded street the one label
     * that must survive is the one saying where the reader is standing.
     */
    const block = /id="me-label"[\s\S]*?\/>/.exec(source)?.[0] ?? '';

    expect(block).toContain("'text-allow-overlap': true");
    expect(block).toContain("'text-ignore-placement': true");
    // No minzoom: it is wanted at every scale, unlike the facility labels.
    expect(block).not.toContain('minzoom');
  });

  it('survives a camera move made before the map is up', () => {
    /*
     * Every camera method goes through setStop, which throws
     * "NativeCameraComponent ref is null" until the native view exists.
     * Uncaught, that is a locate button that silently does nothing.
     */
    const block = /const moveTo = useCallback[\s\S]*?\n  \}, \[\]\);/.exec(source)?.[0] ?? '';

    expect(block).toContain('catch');
    expect(block).toContain('requestAnimationFrame');
  });

  it('draws the person\'s own position rather than relying on UserLocation', () => {
    /*
     * MapLibre's UserLocation runs its own location provider - a second
     * permission prompt and a second thing to fail - and it rendered nothing
     * here. The screen already has a fix, so the dot is drawn from that.
     */
    expect(source).toContain('me-dot');
    expect(source).not.toContain('MapLibreGL.UserLocation');
  });

  it('does not reference the v10 names that were renamed', () => {
    for (const gone of ['MapView', 'ShapeSource', 'CircleLayer', 'setAccessToken']) {
      expect(source).not.toContain(`MapLibreGL.${gone}`);
    }
  });
});
