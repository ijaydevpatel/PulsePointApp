import { readFileSync } from 'fs';
import { join } from 'path';
import { byDistance, Facility } from '../src/domain/facilities';

const SOURCE = readFileSync(
  join(__dirname, '..', 'src', 'ui', 'screens', 'CareScreen.tsx'),
  'utf8',
);

const place = (id: string, km: number): Facility => ({
  id, name: id, named: true, kind: 'CLINIC', lat: 0, lon: 0, km,
  open24h: false, urgent: false, phone: null, address: null,
});

describe('the rings', () => {
  it('only ever grow', () => {
    const rings = /const RINGS = \[([^\]]+)\]/.exec(SOURCE)?.[1]
      ?.split(',').map((n) => Number(n.trim())) ?? [];

    expect(rings.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i]!).toBeGreaterThan(rings[i - 1]!);
    }
  });

  it('starts small enough to answer quickly', () => {
    const first = Number(/const RINGS = \[([0-9.]+)/.exec(SOURCE)?.[1]);

    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThanOrEqual(0.02);
  });

  it('ends at the full search radius', () => {
    const rings = /const RINGS = \[([^\]]+)\]/.exec(SOURCE)?.[1]
      ?.split(',').map((n) => Number(n.trim())) ?? [];

    expect(rings[rings.length - 1]).toBeCloseTo(0.06, 3);
  });
});

describe('merging', () => {
  it('keeps what earlier rings found', () => {
    const found = new Map<string, Facility>();
    for (const f of [place('a', 0.4), place('b', 0.9)]) found.set(f.id, f);
    for (const f of [place('a', 0.4), place('c', 2.2)]) found.set(f.id, f);

    expect([...found.keys()].sort()).toEqual(['a', 'b', 'c']);
  });

  it('stays nearest-first as it grows', () => {
    const merged = [place('far', 5.1), place('near', 0.3), place('mid', 2.0)]
      .sort(byDistance);

    expect(merged.map((f) => f.id)).toEqual(['near', 'mid', 'far']);
  });
});

describe('a search that has been superseded', () => {
  it('cannot overwrite a newer one', () => {
    expect(SOURCE).toContain('const run = ++searchRun.current;');
    expect(SOURCE).toContain('const alive = () => searchRun.current === run;');
    expect(SOURCE).toMatch(/if \(!alive\(\)\) return;/);
  });
});
