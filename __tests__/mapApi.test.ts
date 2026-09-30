import { readFileSync } from 'fs';
import { join } from 'path';

const SCREEN = join(__dirname, '..', 'src', 'ui', 'screens', 'CareScreen.tsx');
const PACKAGE = '@maplibre/maplibre-react-native';

function usedNames(source: string): string[] {
  const found = new Set<string>();
  for (const m of source.matchAll(/MapLibreGL[?]?\.(\w+)/g)) {
    found.add(m[1]!);
  }
  return [...found].sort();
}

function exportedNames(): Set<string> {
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
    expect(usedNames(source).length).toBeGreaterThanOrEqual(4);
  });

  it('still guards on a component rather than on the module', () => {
    expect(source).toMatch(/MapLibreGL\?\.Map\b/);
  });

  it('labels the pins with a font the style actually serves', () => {
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
    expect(source).toContain('me-halo');
    expect(source).toContain('me-disc');
    expect(source).toContain('me-dot');
    expect(source).toContain('You are here');
  });

  it('never lets the "you are here" caption be dropped', () => {
    const block = /id="me-label"[\s\S]*?\/>/.exec(source)?.[0] ?? '';

    expect(block).toContain("'text-allow-overlap': true");
    expect(block).toContain("'text-ignore-placement': true");

    expect(block).not.toContain('minzoom');
  });

  it('survives a camera move made before the map is up', () => {
    const block = /const moveTo = useCallback[\s\S]*?\n  \}, \[\]\);/.exec(source)?.[0] ?? '';

    expect(block).toContain('catch');
    expect(block).toContain('requestAnimationFrame');
  });

  it('draws the person\'s own position rather than relying on UserLocation', () => {
    expect(source).toContain('me-dot');
    expect(source).not.toContain('MapLibreGL.UserLocation');
  });

  it('does not reference the v10 names that were renamed', () => {
    for (const gone of ['MapView', 'ShapeSource', 'CircleLayer', 'setAccessToken']) {
      expect(source).not.toContain(`MapLibreGL.${gone}`);
    }
  });

  it('routes in the maps app rather than dropping a pin', () => {
    const block = /async function openDirections[\s\S]*?\n\}/.exec(source)?.[0] ?? '';

    expect(block).toContain('maps/dir/');
    expect(block).toMatch(/destination=/);

    expect(block).toContain('daddr=');
  });

  it('hit-tests pin taps against the pin layer, with a tolerance', () => {
    const block = /const tapMap = useCallback[\s\S]*?\n  \}, \[facilities\]\);/.exec(source)?.[0] ?? '';

    expect(block).toContain("layers: ['facility-pins']");
    expect(block).toContain('TAP_SLOP');
  });

  it('passes the tolerance box as nested corners', () => {
    const block = /const box: \[\[number, number\], \[number, number\]\] = \[[\s\S]*?\];/.exec(source)?.[0];

    expect(block).toBeDefined();
    expect(block).toMatch(/\[x - TAP_SLOP, y - TAP_SLOP\]/);
    expect(block).toMatch(/\[x \+ TAP_SLOP, y \+ TAP_SLOP\]/);
  });

  it('asks before leaving the app', () => {
    const block = /const tapMap = useCallback[\s\S]*?\n  \}, \[facilities\]\);/.exec(source)?.[0] ?? '';

    expect(block).not.toContain('openDirections');
    expect(source).toMatch(/title="Directions"/);
  });

  it('carries the facility id in feature properties', () => {
    expect(source).toMatch(/properties: \{[\s\S]*?id: f\.id/);
  });

  it('draws pins from plain properties, not conditional expressions', () => {
    const pins = /id="facility-pins"[\s\S]*?\/>/.exec(source)?.[0] ?? '';
    const labels = /id="facility-labels"[\s\S]*?\/>/.exec(source)?.[0] ?? '';

    expect(pins.length).toBeGreaterThan(50);
    expect(labels.length).toBeGreaterThan(50);

    for (const block of [pins, labels]) {
      expect(block).not.toContain("['case'");
      expect(block).not.toContain('[\'case\'');
    }

    expect(labels).toContain("'text-field': ['get', 'label']");
  });

  it('gives every pin the properties those layers read', () => {
    const props = /properties: \{[\s\S]*?\},/.exec(source)?.[0] ?? '';

    for (const key of ['label', 'colour', 'radius', 'stroke', 'size', 'sort']) {
      expect(props).toContain(`${key}:`);
    }
  });
});
