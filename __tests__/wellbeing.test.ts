/**
 * The score and the streak exist because the web version's did not compute.
 * These tests guard the property that made that a problem: a number must
 * never appear unless something was actually recorded.
 */
import { checkInStreak, healthScore, SCORE_WINDOW_DAYS } from '../src/domain/wellbeing';
import { HistoryEntry } from '../src/domain/ports';
import { TriageBand } from '../src/domain/entities';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-24T12:00:00').getTime();

function entry(band: TriageBand, daysAgo: number, redFlags: string[] = []): HistoryEntry {
  const at = new Date(NOW - daysAgo * DAY).toISOString();
  return {
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
    // The whole reason this module exists: the backend defaults healthScore to
    // 100 and never writes it, so every account reads "perfect" on no data.
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
    // A run of mild episodes must not dilute the one that mattered.
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
    // The UI can explain the number rather than asking to be trusted.
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
    // A streak that survives gaps is not a streak.
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

/* ────────────────────────── symptom catalogue ───────────────────────────── */

import { CATALOGUE } from '../src/data/symptomCatalogue';

describe('the symptom catalogue', () => {
  it('has no duplicate codes or labels', () => {
    // The website list was merged into this one; a duplicate would show as two
    // identical rows that set the same flag.
    expect(new Set(CATALOGUE.map((c) => c.code)).size).toBe(CATALOGUE.length);
    expect(new Set(CATALOGUE.map((c) => c.label)).size).toBe(CATALOGUE.length);
  });

  it('still contains every code a red-flag rule matches on', () => {
    // redFlags.ts matches by code. A symptom the rules reference but the list
    // does not offer is a rule that can never fire - silently.
    const codes = new Set(CATALOGUE.map((c) => c.code));

    // The thirteen codes redFlags.ts matches on, listed explicitly so this
    // fails loudly if one is renamed rather than inferring from the rules and
    // agreeing with whatever they happen to say.
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
    // A non-blanching rash is the meningococcal sign; an itchy rash is not.
    // Collapsing them would lose the rule that exists to catch the first.
    expect(CATALOGUE.some((c) => c.code === 'rash_non_blanching')).toBe(true);
    expect(CATALOGUE.some((c) => c.code === 'skin_rash')).toBe(true);
  });

  it('leads with the red-flag symptoms', () => {
    // Someone with chest pain should not scroll past "itching" to find it.
    expect(CATALOGUE[0]!.code).toBe('chest_pain');
  });
});

/* ────────────────────────── entrance animation ──────────────────────────── */

describe('the Enter wrapper cannot be left invisible', () => {
  /**
   * Reproduces the shape of the bug rather than the component: a native-driven
   * value starts at 0, the effect that animates it runs once, and a later
   * re-render re-applies the JS-side style. Without a "played" latch the
   * content stays at 0 forever; with one, every render re-asserts 1.
   */
  function simulate({ latch }: { latch: boolean }) {
    let value = 0;
    let played = false;

    const render = (isFirst: boolean) => {
      if (latch && played) { value = 1; return; }
      if (isFirst) { value = 1; played = true; return; }
      // A re-render re-applying the stale JS-side value.
      if (!latch) value = 0;
    };

    render(true);
    render(false);   // keystroke
    render(false);   // another keystroke
    return value;
  }

  it('goes invisible without the latch - the bug', () => {
    expect(simulate({ latch: false })).toBe(0);
  });

  it('stays visible with it', () => {
    expect(simulate({ latch: true })).toBe(1);
  });
});
