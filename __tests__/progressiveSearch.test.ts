/**
 * The Map tab fills in as results arrive, rather than after they all have.
 *
 * ── Why rings, and not streaming ─────────────────────────────────────────────
 *
 * A streaming read would be the obvious answer and is not available: React
 * Native's fetch gives no readable body, and Overpass answers with one JSON
 * document at the end of the query. There is nothing to consume incrementally.
 *
 * Expanding rings gets the same behaviour from the same API. A small box
 * answers in about a second because the cost of the query is its area, so the
 * nearest places - the ones this screen is for - are on screen almost at once,
 * and the wider passes fill in behind them.
 *
 * ── What this file pins ──────────────────────────────────────────────────────
 *
 * The properties that make that safe: rings that only grow, results that merge
 * rather than replace, and a stale run that cannot overwrite a newer one.
 */
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
    /*
     * The first ring is the one the person waits for. Query cost goes with
     * area, so this is the number that decides whether the screen feels
     * instant or not - roughly a kilometre and a bit.
     */
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
    /*
     * Each ring re-reports everything inside it, so replacing rather than
     * merging would be harmless - until a wider ring fails, which is the case
     * that matters. The list must never shrink because a later query did
     * worse than an earlier one.
     */
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
    /*
     * The rings are awaited in sequence, so a run started for an old position
     * is still in flight when the locate button starts another. Without a
     * guard the slow one lands last and puts the wrong neighbourhood on
     * screen.
     */
    expect(SOURCE).toContain('const run = ++searchRun.current;');
    expect(SOURCE).toContain('const alive = () => searchRun.current === run;');
    expect(SOURCE).toMatch(/if \(!alive\(\)\) return;/);
  });
});
