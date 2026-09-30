import { CheckInteractionsUseCase } from '../src/domain/checkInteractions';
import { BundledInteractionTable } from '../src/data/interactionTable';
import { needsAttention, severityRank } from '../src/domain/medicines';

const table = new BundledInteractionTable();
const check = new CheckInteractionsUseCase(table);

describe('the web app regression', () => {
  it('flags Warfarin + Aspirin as MAJOR - the case that silently returned nothing', () => {
    const r = check.execute(['Warfarin', 'Aspirin']);
    expect(r.outcome).toBe('FINDINGS');
    expect(r.highest).toBe('MAJOR');
    expect(r.findings.length).toBeGreaterThan(0);
    expect(needsAttention(r)).toBe(true);
  });

  it('reaches the same verdict from brand names on a box', () => {
    const r = check.execute(['Marevan', 'Cartia']);
    expect(r.highest).toBe('MAJOR');
  });

  it('is symmetric - order of entry cannot change the verdict', () => {
    const a = check.execute(['Warfarin', 'Ibuprofen']);
    const b = check.execute(['Ibuprofen', 'Warfarin']);
    expect(a.highest).toBe(b.highest);
    expect(a.findings.length).toBe(b.findings.length);
  });
});

describe('never claims safety it cannot support', () => {
  it('has no outcome meaning "safe"', () => {
    const r = check.execute(['Paracetamol', 'Salbutamol']);
    expect(r.outcome).toBe('CLEAR');

    expect(Object.keys(r)).not.toContain('safe');
  });

  it('reports an unknown medicine instead of quietly ignoring it', () => {
    const r = check.execute(['Warfarin', 'Xyzzyzine']);
    expect(r.unrecognised).toContain('Xyzzyzine');

    expect(r.outcome).toBe('NOT_ENOUGH');
  });

  it('does not report a clean check when every entry was unrecognised', () => {
    const r = check.execute(['Blorbitol', 'Zanthomycin']);
    expect(r.outcome).toBe('NOT_ENOUGH');
    expect(r.unrecognised).toHaveLength(2);
  });

  it('counts the pairs it actually compared', () => {
    const r = check.execute(['Warfarin', 'Ibuprofen', 'Paracetamol']);
    expect(r.pairsChecked).toBe(3);
  });
});

describe('matching', () => {
  it('treats two brands of one generic as a single medicine', () => {
    const r = check.execute(['Paracetamol', 'Panadol']);
    expect(r.recognised).toEqual(['Paracetamol']);
    expect(r.outcome).toBe('NOT_ENOUGH');
  });

  it('never pairs a drug with itself, even across two of its classes', () => {
    const r = check.execute(['Aspirin']);
    expect(r.findings).toHaveLength(0);
    expect(r.pairsChecked).toBe(0);
  });

  it('resolves a name written with a strength', () => {
    const r = check.execute(['Ibuprofen 400mg', 'Warfarin 5 mg tablets']);
    expect(r.highest).toBe('MAJOR');
    expect(r.unrecognised).toHaveLength(0);
  });

  it('applies class rules across the whole class, not just one member', () => {
    for (const nsaid of ['Naproxen', 'Diclofenac', 'Celecoxib', 'Voltaren']) {
      const r = check.execute(['Warfarin', nsaid]);
      expect(r.highest).toBe('MAJOR');
    }
  });
});

describe('ordering', () => {
  it('puts the most severe finding first so it cannot be buried', () => {
    const r = check.execute(['Warfarin', 'Ibuprofen', 'Paracetamol']);
    for (let i = 1; i < r.findings.length; i++) {
      expect(severityRank(r.findings[i - 1]!.severity))
        .toBeGreaterThanOrEqual(severityRank(r.findings[i]!.severity));
    }
  });

  it('reports the highest severity across all findings', () => {
    const r = check.execute(['Warfarin', 'Paracetamol', 'Ibuprofen']);
    expect(r.highest).toBe('MAJOR');
  });
});

describe('known-dangerous pairs are all caught', () => {
  const cases: [string, string][] = [
    ['Sildenafil', 'Isosorbide mononitrate'],
    ['Tranylcypromine', 'Fluoxetine'],
    ['Simvastatin', 'Clarithromycin'],
    ['Methotrexate', 'Trimethoprim'],
    ['Allopurinol', 'Azathioprine'],
    ['Lithium', 'Ibuprofen'],
    ['Morphine', 'Diazepam'],
    ['Digoxin', 'Amiodarone'],
    ['Metoprolol', 'Verapamil'],
    ['Cilazapril', 'Spironolactone'],
  ];

  it.each(cases)('%s + %s is MAJOR', (a, b) => {
    const r = check.execute([a, b]);
    expect(r.highest).toBe('MAJOR');
  });
});

describe('table integrity', () => {
  it('has no duplicate rule ids', () => {
    const ids = table.rules().map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every rule an effect, advice and a source', () => {
    for (const r of table.rules()) {
      expect(r.effect.length).toBeGreaterThan(20);
      expect(r.advice.length).toBeGreaterThan(20);
      expect(r.source.length).toBeGreaterThan(0);
    }
  });

  it('never tells the user to stop a prescribed medicine on their own', () => {
    for (const r of table.rules()) {
      const text = `${r.effect} ${r.advice}`.toLowerCase();
      expect(text).not.toMatch(/\bstop taking\b/);
    }
  });

  it('carries a version so a stale table can be detected', () => {
    expect(table.version).toMatch(/^\d{4}\.\d{2}/);
  });
});
