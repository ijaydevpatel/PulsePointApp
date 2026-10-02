import { reconcileMedicineCheck, toBand } from '../src/domain/medicineVerdict';
import { MedicineCheck } from '../src/domain/remote';

/*
 * The defect this covers: a real check returned "Generally Safe" and
 * "RISK: LOW" for Dolo 650 with aspirin, while the advice said to avoid taking
 * both at once and two critical markers were listed.
 */

function check(over: Partial<MedicineCheck> = {}): MedicineCheck {
  return {
    compatibilityVerdict: 'Generally Safe',
    riskLevel: 'Low',
    riskPercentage: 10,
    dangerDetected: false,
    conflictFlags: [],
    interactionCause: '',
    explanation: '',
    patientAdvice: '',
    metabolicPathway: '',
    agentA: null,
    agentB: null,
    safeAlternatives: [],
    warnings: [],
    ...over,
  } as MedicineCheck;
}

describe('a reassuring headline cannot sit beside reported evidence', () => {
  it('raises the band when critical markers are listed', () => {
    const out = reconcileMedicineCheck(check({
      warnings: [
        'Potential hepatotoxicity from increased NAPQI formation',
        'Gastrointestinal irritation or bleeding risk from aspirin',
      ],
    }));

    expect(out.risk).toBe('MODERATE');
    expect(out.escalated).toBe(true);
    expect(out.verdict).not.toMatch(/safe/i);
    expect(out.reason).toContain('2 critical markers');
  });

  it('raises the band when a conflict flag is present', () => {
    const out = reconcileMedicineCheck(check({ conflictFlags: ['Direct Database Match'] }));

    expect(out.risk).toBe('MODERATE');
    expect(out.verdict).toBe('Care needed');
  });

  it('goes to the top band when a danger is reported', () => {
    const out = reconcileMedicineCheck(check({ dangerDetected: true }));

    expect(out.risk).toBe('HIGH');
    expect(out.reason).toBe('the check reported a danger');
  });
});

describe('it only ever escalates', () => {
  it('leaves a clean low result alone', () => {
    const out = reconcileMedicineCheck(check());

    expect(out.risk).toBe('LOW');
    expect(out.escalated).toBe(false);
    expect(out.verdict).toBe('Generally Safe');
    expect(out.reason).toBeNull();
  });

  it('never lowers a band the model set higher than the evidence floor', () => {
    const out = reconcileMedicineCheck(check({
      riskLevel: 'High',
      compatibilityVerdict: 'Do not combine',
      conflictFlags: ['Direct Database Match'],
    }));

    expect(out.risk).toBe('HIGH');
    expect(out.escalated).toBe(false);
  });

  it('keeps a non-reassuring verdict even when it raises the band', () => {
    const out = reconcileMedicineCheck(check({
      compatibilityVerdict: 'Caution advised',
      warnings: ['Additive bleeding risk'],
    }));

    expect(out.risk).toBe('MODERATE');
    expect(out.escalated).toBe(true);
    expect(out.verdict).toBe('Caution advised');
  });

  it('supplies a headline when the model sent none', () => {
    const out = reconcileMedicineCheck(check({
      compatibilityVerdict: '   ',
      dangerDetected: true,
    }));

    expect(out.verdict).toBe('Care needed');
  });
});

describe('band parsing', () => {
  it('maps the wordings the backend uses', () => {
    expect(toBand('Low')).toBe('LOW');
    expect(toBand('moderate')).toBe('MODERATE');
    expect(toBand('Medium')).toBe('MODERATE');
    expect(toBand('CRITICAL')).toBe('HIGH');
    expect(toBand('')).toBe('UNKNOWN');
  });
});
