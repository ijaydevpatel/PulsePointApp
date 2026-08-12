/**
 * Phase 1 tests. Note these run in plain node with NO emulator and NO device —
 * that is the payoff of requirement L2 (domain layer has zero platform imports).
 * Evaluation criterion E4 requires 100% branch coverage of red-flag rules.
 */
import { AssessSymptomsUseCase, bandForSeverity } from '../src/domain/assessSymptoms';
import { detectRedFlags, RED_FLAG_RULES } from '../src/domain/redFlags';
import { RuleClassifier } from '../src/data/ruleClassifier';
import { InMemoryEpisodeStore } from '../src/data/memoryStore';
import { SymptomEpisode, AgeBand, requiresEscalation } from '../src/domain/entities';
import { Classifier } from '../src/domain/ports';

const ep = (
  codes: [string, number][],
  ageBand: AgeBand = 'ADULT',
  durationHours = 6,
): SymptomEpisode => ({
  id: 'test', capturedAt: new Date().toISOString(), ageBand, durationHours,
  symptoms: codes.map(([code, severity]) => ({ code, severity, label: code })),
});

const run = (e: SymptomEpisode, c: Classifier = new RuleClassifier()) =>
  new AssessSymptomsUseCase(c, new InMemoryEpisodeStore()).execute(e);

describe('band thresholds', () => {
  it('maps severity to the right band', () => {
    expect(bandForSeverity(10)).toBe('SELF_CARE');
    expect(bandForSeverity(30)).toBe('PHARMACY_GP');
    expect(bandForSeverity(60)).toBe('URGENT');
    expect(bandForSeverity(90)).toBe('EMERGENCY');
  });
});

describe('red-flag rules (FR3, QR5)', () => {
  it('every rule has at least one triggering case', () => {
    const cases: Record<string, SymptomEpisode> = {
      'RF-CARDIAC': ep([['chest_pain', 5], ['breathlessness', 4]]),
      'RF-STROKE': ep([['facial_droop', 5]]),
      'RF-SEPSIS': ep([['fever', 8], ['confusion', 5]]),
      'RF-BREATHING': ep([['breathlessness', 9]]),
      'RF-MENINGITIS': ep([['headache', 8], ['neck_stiffness', 5]]),
      'RF-DEHYDRATION-CHILD': ep([['vomiting', 4]], 'CHILD', 30),
      'RF-OLDER-FEVER': ep([['fever', 7]], 'OLDER_ADULT', 60),
    };
    for (const rule of RED_FLAG_RULES) {
      const c = cases[rule.id];
      expect(c).toBeDefined();
      expect(detectRedFlags(c!).ids).toContain(rule.id);
    }
  });

  it('returns nothing for a benign presentation', () => {
    expect(detectRedFlags(ep([['runny_nose', 2], ['sore_throat', 2]])).ids).toHaveLength(0);
  });

  it('escalates to EMERGENCY when any emergency rule fires', () => {
    expect(detectRedFlags(ep([['headache', 8], ['neck_stiffness', 5], ['facial_droop', 3]])).band)
      .toBe('EMERGENCY');
  });
});

describe('AssessSymptomsUseCase ordering (QR5)', () => {
  it('a red flag escalates even when the classifier scores low', async () => {
    const lowballer: Classifier = {
      id: 'stub',
      classify: async () => ({ severity: 1, confidence: 0.99, rationale: [] }),
    };
    const r = await run(ep([['facial_droop', 2]]), lowballer);
    expect(r.band).toBe('EMERGENCY');
    expect(r.redFlags.length).toBeGreaterThan(0);
    expect(requiresEscalation(r)).toBe(true);
  });

  it('low confidence never suppresses an escalation', async () => {
    const unsure: Classifier = {
      id: 'stub',
      classify: async () => ({ severity: 0, confidence: 0.01, rationale: [] }),
    };
    const r = await run(ep([['chest_pain', 6], ['breathlessness', 6]]), unsure);
    expect(r.band).toBe('EMERGENCY');
  });

  it('never de-escalates below the scored band', async () => {
    const high: Classifier = {
      id: 'stub',
      classify: async () => ({ severity: 95, confidence: 0.9, rationale: [] }),
    };
    const r = await run(ep([['cough', 2]]), high);
    expect(r.band).toBe('EMERGENCY');
  });

  it('benign symptoms stay in self-care', async () => {
    const r = await run(ep([['runny_nose', 2]]));
    expect(r.band).toBe('SELF_CARE');
    expect(r.redFlags).toHaveLength(0);
  });

  it('marks new results PENDING_SYNC (R2)', async () => {
    const r = await run(ep([['cough', 3]]));
    expect(r.syncStatus).toBe('PENDING_SYNC');
  });
});

describe('substitutability (L1 / criterion E5)', () => {
  it('swapping the classifier requires no change above the data layer', async () => {
    const fake: Classifier = {
      id: 'tflite-v1',
      classify: async () => ({ severity: 40, confidence: 0.8, rationale: ['model'] }),
    };
    const r = await run(ep([['cough', 3]]), fake);
    expect(r.source).toBe('ON_DEVICE_MODEL');
    expect(r.band).toBe('PHARMACY_GP');
  });
});

describe('performance budget (QR1)', () => {
  it('classifies well inside 500 ms', async () => {
    const t0 = Date.now();
    await run(ep([['cough', 3], ['fever', 5], ['fatigue', 4]]));
    expect(Date.now() - t0).toBeLessThan(500);
  });
});
