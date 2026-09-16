/**
 * The two models, tested against the contract the backend actually exposes.
 *
 *   POST /api/symptoms/analyze
 *   POST /api/medicine/check
 *
 * Everything here runs in plain node with an injected fetch. No device, no
 * network, and no real Groq/Gemini key is ever touched.
 */
import { ApiClient } from '../src/data/apiClient';
import { RemoteSymptomAnalysis, RemoteMedicineCheck } from '../src/data/remoteServices';
import { combineWithRemote } from '../src/domain/remote';
import {
  createOnDeviceClassifier, TFLiteBackend, toFeatureVector, FEATURE_CODES, ModelBackend,
} from '../src/data/onDeviceClassifier';
import { AssessSymptomsUseCase } from '../src/domain/assessSymptoms';
import { InMemoryEpisodeStore } from '../src/data/memoryStore';
import { SymptomEpisode } from '../src/domain/entities';

const ep = (codes: [string, number][]): SymptomEpisode => ({
  id: 'e1', capturedAt: new Date().toISOString(), ageBand: 'ADULT', durationHours: 6,
  symptoms: codes.map(([code, severity]) => ({ code, severity, label: code })),
});

const jsonRes = (body: unknown, ok = true, status = 200) => ({
  ok, status,
  headers: { get: () => 'application/json' },
  json: async () => body,
}) as unknown as Response;

const htmlRes = (status = 502) => ({
  ok: false, status,
  headers: { get: () => 'text/html; charset=utf-8' },
  json: async () => { throw new SyntaxError("Unexpected token '<'"); },
}) as unknown as Response;

function client(res: () => Promise<Response>, token: string | null = 'tok', url: string | null = 'https://api.test') {
  const c = new ApiClient(url, 30000, (async () => res()) as unknown as typeof fetch);
  c.setTokenProvider(async () => token);
  return c;
}

const MATRIX = {
  probabilityMatrix: [
    { name: 'Influenza', confidence: 62, severity: 'Medium' },
    { name: 'Meningitis', confidence: 8, severity: 'Critical' },
  ],
  treatmentPathways: { allopathy: ['Paracetamol 500mg'], homeopathic: [], homeRemedies: ['Rest'] },
  summaryText: 'A long synthesis of the diagnostic matrix.',
  isEmergencyOverride: false,
};

describe('model 1 — on-device classifier (QR4 / L1)', () => {
  it('falls back to the rules engine when no model is loaded', async () => {
    const c = createOnDeviceClassifier(new TFLiteBackend(false));
    expect(c.id).not.toBe('tflite-v1');
  });

  it('uses the model and reports its id when one is loaded', async () => {
    const backend: ModelBackend = {
      id: 'tflite-v1', isAvailable: () => true,
      infer: async () => ({ severity: 42, confidence: 0.77 }),
    };
    const r = await createOnDeviceClassifier(backend).classify(ep([['cough', 3]]));
    expect(r.severity).toBe(42);
  });

  it('records the true source so E2 cannot measure the wrong engine', async () => {
    const store = new InMemoryEpisodeStore();
    const withModel: ModelBackend = {
      id: 'tflite-v1', isAvailable: () => true,
      infer: async () => ({ severity: 30, confidence: 0.6 }),
    };
    const a = await new AssessSymptomsUseCase(createOnDeviceClassifier(withModel), store).execute(ep([['cough', 2]]));
    const b = await new AssessSymptomsUseCase(createOnDeviceClassifier(new TFLiteBackend(false)), store).execute(ep([['cough', 2]]));
    expect(a.source).toBe('ON_DEVICE_MODEL');
    expect(b.source).toBe('ON_DEVICE_RULES');
  });

  it('clamps a model that returns nonsense', async () => {
    const rogue: ModelBackend = {
      id: 'tflite-v1', isAvailable: () => true,
      infer: async () => ({ severity: 9999, confidence: -4 }),
    };
    const r = await createOnDeviceClassifier(rogue).classify(ep([['cough', 3]]));
    expect(r.severity).toBe(100);
    expect(r.confidence).toBe(0);
  });

  it('builds a fixed-order feature vector scaled to 0..1', () => {
    const v = toFeatureVector(ep([['chest_pain', 10], ['cough', 5]]));
    expect(v).toHaveLength(FEATURE_CODES.length);
    expect(v[FEATURE_CODES.indexOf('chest_pain')]).toBe(1);
    expect(v[FEATURE_CODES.indexOf('cough')]).toBe(0.5);
  });
});

describe('model 2 — POST /api/symptoms/analyze', () => {
  it('parses the probability matrix and treatment pathways', async () => {
    const r = await new RemoteSymptomAnalysis(client(async () => jsonRes(MATRIX))).analyze(
      { activeSymptoms: ['fever'], customSymptom: '' });
    expect(r.status).toBe('OK');
    expect(r.data!.probabilityMatrix).toHaveLength(2);
    expect(r.data!.probabilityMatrix[1]!.severity).toBe('Critical');
    expect(r.data!.treatmentPathways.allopathy[0]!).toContain('Paracetamol');
  });

  it('sends the exact field names the controller destructures', async () => {
    let sent: any = null;
    const c = new ApiClient('https://api.test', 30000, (async (_u: string, init: any) => {
      sent = JSON.parse(init.body); return jsonRes(MATRIX);
    }) as unknown as typeof fetch);
    c.setTokenProvider(async () => 'tok');
    await new RemoteSymptomAnalysis(c).analyze({ activeSymptoms: ['fever'], customSymptom: 'ache' });
    expect(Object.keys(sent).sort()).toEqual(['activeSymptoms', 'customSymptom']);
  });

  it('sends the Clerk bearer token, and no provider key', async () => {
    let headers: any = null;
    const c = new ApiClient('https://api.test', 30000, (async (_u: string, init: any) => {
      headers = init.headers; return jsonRes(MATRIX);
    }) as unknown as typeof fetch);
    c.setTokenProvider(async () => 'clerk-token');
    await new RemoteSymptomAnalysis(c).analyze({ activeSymptoms: ['fever'], customSymptom: '' });
    expect(headers.Authorization).toBe('Bearer clerk-token');
    expect(JSON.stringify(headers)).not.toMatch(/gsk_|AIza|GROQ|GEMINI/);
  });

  it('reports UNAUTHENTICATED rather than failing silently when signed out', async () => {
    const r = await new RemoteSymptomAnalysis(client(async () => jsonRes(MATRIX), null)).analyze(
      { activeSymptoms: ['fever'], customSymptom: '' });
    expect(r.status).toBe('UNAUTHENTICATED');
    expect(r.notice).toBeTruthy();
  });

  it('reports UNAVAILABLE when no API URL is configured', async () => {
    const r = await new RemoteSymptomAnalysis(client(async () => jsonRes(MATRIX), 'tok', null)).analyze(
      { activeSymptoms: ['fever'], customSymptom: '' });
    expect(r.status).toBe('UNAVAILABLE');
  });

  it('turns an HTML error page into a state instead of a parser crash', async () => {
    // A 502 or CORS failure returns HTML; calling .json() on it throws deep in
    // the parser. This is the guard the web client already has.
    const r = await new RemoteSymptomAnalysis(client(async () => htmlRes())).analyze(
      { activeSymptoms: ['fever'], customSymptom: '' });
    expect(r.status).toBe('FAILED');
    expect(r.notice).toBeTruthy();
  });

  it('treats an empty matrix and empty summary as failure, not success', async () => {
    const r = await new RemoteSymptomAnalysis(client(async () =>
      jsonRes({ probabilityMatrix: [], summaryText: '   ' }))).analyze(
      { activeSymptoms: ['fever'], customSymptom: '' });
    expect(r.status).toBe('FAILED');
    expect(r.data).toBeNull();
  });

  it('never resolves with neither data nor notice', async () => {
    const cases = [
      client(async () => jsonRes(MATRIX)),
      client(async () => jsonRes(MATRIX), null),
      client(async () => htmlRes()),
      client(async () => jsonRes({}, false, 500)),
    ];
    for (const c of cases) {
      const r = await new RemoteSymptomAnalysis(c).analyze({ activeSymptoms: ['x'], customSymptom: '' });
      expect(r.data !== null || r.notice !== null).toBe(true);
    }
  });
});

describe('model 2 — POST /api/medicine/check', () => {
  const OKBODY = {
    compatibilityVerdict: 'Caution advised',
    riskLevel: 'High', riskPercentage: 74, dangerDetected: true,
    conflictFlags: ['Direct Database Match'],
    explanation: 'Additive bleeding risk.',
    safeAlternatives: ['Paracetamol'], warnings: ['Watch for bruising'],
  };

  it('parses the verdict, risk and flags', async () => {
    const r = await new RemoteMedicineCheck(client(async () => jsonRes(OKBODY)))
      .check({ med1: 'Warfarin', med2: 'Aspirin' });
    expect(r.status).toBe('OK');
    expect(r.data!.dangerDetected).toBe(true);
    expect(r.data!.riskPercentage).toBe(74);
    expect(r.data!.conflictFlags).toContain('Direct Database Match');
  });

  it('sends med1 and med2 as the controller expects', async () => {
    let sent: any = null;
    const c = new ApiClient('https://api.test', 30000, (async (_u: string, init: any) => {
      sent = JSON.parse(init.body); return jsonRes(OKBODY);
    }) as unknown as typeof fetch);
    c.setTokenProvider(async () => 'tok');
    await new RemoteMedicineCheck(c).check({ med1: 'Warfarin', med2: 'Aspirin' });
    expect(sent).toEqual({ med1: 'Warfarin', med2: 'Aspirin' });
  });

  it('clamps a risk percentage outside 0..100', async () => {
    const r = await new RemoteMedicineCheck(client(async () =>
      jsonRes({ ...OKBODY, riskPercentage: 500 }))).check({ med1: 'a', med2: 'b' });
    expect(r.data!.riskPercentage).toBe(100);
  });

  it('treats a missing verdict as failure', async () => {
    const r = await new RemoteMedicineCheck(client(async () => jsonRes({ riskLevel: 'High' })))
      .check({ med1: 'a', med2: 'b' });
    expect(r.status).toBe('FAILED');
  });
});

describe('the two models together', () => {
  it('a remote failure never changes the band decided on the device', async () => {
    const store = new InMemoryEpisodeStore();
    const local = await new AssessSymptomsUseCase(
      createOnDeviceClassifier(new TFLiteBackend(false)), store,
    ).execute(ep([['chest_pain', 9], ['breathlessness', 8]]));

    const remote = await new RemoteSymptomAnalysis(client(async () => htmlRes())).analyze(
      { activeSymptoms: ['chest_pain'], customSymptom: '' });

    expect(remote.status).toBe('FAILED');
    expect(combineWithRemote(local.band, remote.data)).toBe('EMERGENCY');
  });

  it('the remote can escalate to EMERGENCY but can never de-escalate', async () => {
    const override = { ...MATRIX, isEmergencyOverride: true };
    const up = await new RemoteSymptomAnalysis(client(async () => jsonRes(override))).analyze(
      { activeSymptoms: ['chest pain'], customSymptom: '' });
    expect(combineWithRemote('SELF_CARE', up.data!)).toBe('EMERGENCY');

    // A calm remote reply must not soften a local EMERGENCY.
    const calm = await new RemoteSymptomAnalysis(client(async () => jsonRes(MATRIX))).analyze(
      { activeSymptoms: ['cough'], customSymptom: '' });
    expect(combineWithRemote('EMERGENCY', calm.data!)).toBe('EMERGENCY');
  });
});
