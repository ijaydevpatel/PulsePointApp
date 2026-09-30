import { ApiClient, DEFAULT_TIMEOUT_MS } from '../src/data/apiClient';
import { RemoteMedicineCheck } from '../src/data/remoteServices';
import { COLLISION_NOTICE, REMOTE_NOTICE } from '../src/domain/remote';

const WIRE = {
  compatibilityVerdict: 'Caution advised',
  riskLevel: 'Medium',
  riskPercentage: 45,
  dangerDetected: false,
  conflictFlags: ['Direct Database Match'],
  isHomeopathic: false,
  interactionCause:
    'Both agents contribute the same active moiety. The concurrent ingestion '
    + 'overwhelms conjugation capacity. A larger fraction is shunted to oxidation. '
    + 'This amplifies the reactive metabolite. Stores may be insufficient. '
    + 'Injury becomes more likely.',
  explanation:
    'One. Two. Three. Four. Five. Six. Seven.',
  patientAdvice:
    'Do not take both together. Separate them by at least four hours. '
    + 'Keep the daily total below 4 g. Avoid alcohol. Watch for jaundice. '
    + 'Speak to a pharmacist.',
  metabolicPathway: 'CYP2E1 oxidation and UGT-mediated glucuronidation',
  techIngredients1: {
    active: 'Paracetamol 500 mg',
    inactive: {
      binders: 'Microcrystalline cellulose, povidone',
      coatings: 'Hypromellose',
      additives: 'Titanium dioxide, polyethylene glycol',
    },
  },
  techIngredients2: {
    active: 'Paracetamol 650 mg',
    inactive: { binders: 'Starch, povidone K30', coatings: 'Hypromellose', additives: '' },
  },
  safeAlternatives: ['Ibuprofen 400 mg oral tablet', 'Naproxen 250 mg oral tablet'],
  warnings: ['Potential hepatotoxicity with cumulative dosing', 'Avoid alcohol'],
};

function clientReturning(body: unknown, ok = true, status = 200): ApiClient {
  const api = new ApiClient('https://example.test', DEFAULT_TIMEOUT_MS, (async () => ({
    ok, status,
    headers: { get: () => 'application/json' },
    json: async () => body,
  })) as any);
  api.setTokenProvider(async () => 'token');
  return api;
}

const run = (body: unknown) =>
  new RemoteMedicineCheck(clientReturning(body)).check({ primaryMedicine: 'Paracetamol', secondaryMedicine: 'Dolo 650' });

describe('collision check mapping', () => {
  it('reads every field the screen renders', async () => {
    const out = await run(WIRE);
    expect(out.status).toBe('OK');

    const d = out.data!;
    expect(d.compatibilityVerdict).toBe('Caution advised');
    expect(d.riskLevel).toBe('Medium');
    expect(d.metabolicPathway).toContain('CYP2E1');
    expect(d.safeAlternatives).toHaveLength(2);
    expect(d.warnings).toHaveLength(2);

    expect(d.conflictFlags).toEqual(['Direct Database Match']);
  });

  it('maps techIngredients1/2 onto the two agent cards', async () => {
    const d = (await run(WIRE)).data!;

    expect(d.agentA?.active).toBe('Paracetamol 500 mg');
    expect(d.agentA?.binders).toContain('povidone');
    expect(d.agentB?.active).toBe('Paracetamol 650 mg');

    expect(d.agentB?.additives).toBe('');
  });

  it('caps the advice at four sentences and the reasoning at three', async () => {
    const d = (await run(WIRE)).data!;
    const sentences = (s: string) => (s.match(/[.!?](\s|$)/g) ?? []).length;

    expect(sentences(d.patientAdvice)).toBe(4);
    expect(sentences(d.interactionCause)).toBe(3);
    expect(sentences(d.explanation)).toBe(3);

    for (const block of [d.interactionCause, d.explanation, d.patientAdvice]) {
      expect(block.trim()).toMatch(/[.!?]$/);
    }
  });

  it('survives a response with the prose fields missing', async () => {
    const d = (await run({ compatibilityVerdict: 'Unknown', riskLevel: 'Low' })).data!;

    expect(d.interactionCause).toBe('');
    expect(d.patientAdvice).toBe('');
    expect(d.agentA).toBeNull();
    expect(d.agentB).toBeNull();
    expect(d.safeAlternatives).toEqual([]);
  });

  it('treats a verdict-less response as a failure, not a blank result', async () => {
    const out = await run({ riskLevel: 'Low', explanation: 'Something.' });

    expect(out.status).not.toBe('OK');
    expect(out.data).toBeNull();
    expect(out.notice).toBeTruthy();
  });
});

describe('what a failed collision check says', () => {
  it('never claims anything was checked locally', async () => {
    const out = await run({ riskLevel: 'Low' });

    expect(out.notice).toBeTruthy();
    expect(out.notice).not.toMatch(/device|offline|locally/i);
    expect(out.notice).toContain('Nothing was checked');
  });

  it('does not reuse the triage wording', () => {
    for (const state of ['UNAUTHENTICATED', 'UNAVAILABLE', 'TIMEOUT', 'FAILED'] as const) {
      expect(COLLISION_NOTICE[state]).not.toBe(REMOTE_NOTICE[state]);
      expect(COLLISION_NOTICE[state]).not.toMatch(/device|offline/i);
    }
  });
});
