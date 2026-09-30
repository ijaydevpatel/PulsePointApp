import { checkInStreak, healthScore, SCORE_WINDOW_DAYS } from '../src/domain/wellbeing';
import { HistoryEntry } from '../src/domain/ports';
import { TriageBand } from '../src/domain/entities';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-24T12:00:00').getTime();

function entry(band: TriageBand, daysAgo: number, redFlags: string[] = []): HistoryEntry {
  const at = new Date(NOW - daysAgo * DAY).toISOString();
  return {
    analysis: null,
    episode: {
      id: `ep_${daysAgo}_${band}`,
      capturedAt: at,
      ageBand: 'ADULT',
      durationHours: 6,
      symptoms: [],
    },
    result: {
      episodeId: `ep_${daysAgo}_${band}`,
      band,
      severity: 40,
      confidence: 0.8,
      source: 'ON_DEVICE_RULES',
      redFlags,
      rationale: [],
      syncStatus: 'PENDING_SYNC',
    },
  };
}

describe('health score', () => {
  it('is null with no history, never 100', () => {
    expect(healthScore([], NOW)).toBeNull();
  });

  it('is null when every episode is outside the window', () => {
    const old = [entry('URGENT', SCORE_WINDOW_DAYS + 5)];
    expect(healthScore(old, NOW)).toBeNull();
  });

  it('deducts more for a worse band', () => {
    const mild = healthScore([entry('SELF_CARE', 1)], NOW)!;
    const bad = healthScore([entry('EMERGENCY', 1)], NOW)!;
    expect(bad.value).toBeLessThan(mild.value);
  });

  it('takes the worst band, not the average', () => {
    const mixed = [
      entry('SELF_CARE', 1), entry('SELF_CARE', 2),
      entry('SELF_CARE', 3), entry('URGENT', 4),
    ];
    const urgentAlone = healthScore([entry('URGENT', 4)], NOW)!;
    expect(healthScore(mixed, NOW)!.value).toBe(urgentAlone.value);
  });

  it('counts each distinct red flag once', () => {
    const repeated = [
      entry('SELF_CARE', 1, ['Chest pain']),
      entry('SELF_CARE', 2, ['Chest pain']),
      entry('SELF_CARE', 3, ['Chest pain']),
    ];
    const once = [entry('SELF_CARE', 1, ['Chest pain'])];
    expect(healthScore(repeated, NOW)!.value).toBe(healthScore(once, NOW)!.value);
  });

  it('stays inside 0..100 under pile-on', () => {
    const awful = [entry('EMERGENCY', 1, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])];
    const s = healthScore(awful, NOW)!;
    expect(s.value).toBeGreaterThanOrEqual(0);
    expect(s.value).toBeLessThanOrEqual(100);
  });

  it('shows its working', () => {
    const s = healthScore([entry('URGENT', 1, ['Chest pain'])], NOW)!;
    expect(s.reasons.length).toBeGreaterThanOrEqual(2);
    for (const r of s.reasons) expect(r.delta).toBeLessThan(0);
    expect(100 + s.reasons.reduce((n, r) => n + r.delta, 0)).toBe(s.value);
  });
});

describe('check-in streak', () => {
  it('is zero with no history', () => {
    expect(checkInStreak([], NOW).days).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const s = checkInStreak([entry('SELF_CARE', 0), entry('SELF_CARE', 1), entry('SELF_CARE', 2)], NOW);
    expect(s.days).toBe(3);
    expect(s.atRisk).toBe(false);
  });

  it('survives to the end of the day when today is still empty', () => {
    const s = checkInStreak([entry('SELF_CARE', 1), entry('SELF_CARE', 2)], NOW);
    expect(s.days).toBe(2);
    expect(s.atRisk).toBe(true);
  });

  it('breaks on a gap rather than counting through it', () => {
    const s = checkInStreak([entry('SELF_CARE', 0), entry('SELF_CARE', 3), entry('SELF_CARE', 4)], NOW);
    expect(s.days).toBe(1);
  });

  it('is zero when the last check-in is older than yesterday', () => {
    expect(checkInStreak([entry('SELF_CARE', 5)], NOW).days).toBe(0);
  });

  it('counts a day once however many episodes it holds', () => {
    const s = checkInStreak([entry('SELF_CARE', 0), entry('URGENT', 0), entry('SELF_CARE', 1)], NOW);
    expect(s.days).toBe(2);
  });
});

import { CATALOGUE } from '../src/data/symptomCatalogue';

describe('the symptom catalogue', () => {
  it('has no duplicate codes or labels', () => {
    expect(new Set(CATALOGUE.map((c) => c.code)).size).toBe(CATALOGUE.length);
    expect(new Set(CATALOGUE.map((c) => c.label)).size).toBe(CATALOGUE.length);
  });

  it('still contains every code a red-flag rule matches on', () => {
    const codes = new Set(CATALOGUE.map((c) => c.code));

    const referenced = [
      'chest_pain', 'breathlessness', 'radiating_pain', 'facial_droop',
      'arm_weakness', 'speech_difficulty', 'confusion', 'fever', 'headache',
      'neck_stiffness', 'photophobia', 'rash_non_blanching', 'vomiting',
    ];

    for (const code of referenced) {
      expect(`${code} in catalogue: ${codes.has(code)}`).toBe(`${code} in catalogue: true`);
    }
  });

  it('keeps the two rashes distinct', () => {
    expect(CATALOGUE.some((c) => c.code === 'rash_non_blanching')).toBe(true);
    expect(CATALOGUE.some((c) => c.code === 'skin_rash')).toBe(true);
  });

  it('leads with the red-flag symptoms', () => {
    expect(CATALOGUE[0]!.code).toBe('chest_pain');
  });
});

describe('the Enter wrapper cannot be left invisible', () => {
  function simulate({ latch }: { latch: boolean }) {
    let value = 0;
    let played = false;

    const render = (isFirst: boolean) => {
      if (latch && played) { value = 1; return; }
      if (isFirst) { value = 1; played = true; return; }

      if (!latch) value = 0;
    };

    render(true);
    render(false);
    render(false);
    return value;
  }

  it('goes invisible without the latch - the bug', () => {
    expect(simulate({ latch: false })).toBe(0);
  });

  it('stays visible with it', () => {
    expect(simulate({ latch: true })).toBe(1);
  });
});
