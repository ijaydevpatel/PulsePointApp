import { RuleClassifier } from '../src/data/ruleClassifier';
import { AssessSymptomsUseCase } from '../src/domain/assessSymptoms';
import { SymptomEpisode, Symptom } from '../src/domain/entities';
import { EpisodeStore } from '../src/domain/ports';

const sym = (code: string, severity: number, label = code): Symptom => ({ code, severity, label });

const episode = (symptoms: Symptom[], over: Partial<SymptomEpisode> = {}): SymptomEpisode => ({
  id: 'ep_test',
  capturedAt: new Date().toISOString(),
  ageBand: 'ADULT',
  durationHours: 24,
  symptoms,
  ...over,
});

const classifier = new RuleClassifier();
const confidenceOf = async (symptoms: Symptom[], over: Partial<SymptomEpisode> = {}) =>
  (await classifier.classify(episode(symptoms, over))).confidence;

describe('rule classifier confidence', () => {
  it('is not the same number for every small episode', async () => {
    const values = await Promise.all([
      confidenceOf([sym('runny_nose', 2)]),
      confidenceOf([sym('chest_pain', 9)]),
      confidenceOf([sym('fatigue', 3), sym('headache', 4)]),
      confidenceOf([sym('facial_droop', 9), sym('speech_difficulty', 8)]),
      confidenceOf([sym('cough', 2), sym('sore_throat', 3), sym('fever', 5)]),
    ]);

    expect(new Set(values).size).toBeGreaterThan(3);
    expect(values).not.toContain(0.45);
  });

  it('rises with more evidence, all else equal', async () => {
    const one = await confidenceOf([sym('fever', 5)]);
    const two = await confidenceOf([sym('fever', 5), sym('cough', 5)]);
    const three = await confidenceOf([sym('fever', 5), sym('cough', 5), sym('headache', 5)]);

    expect(two).toBeGreaterThan(one);
    expect(three).toBeGreaterThan(two);
  });

  it('is lower for vague symptoms than for specific ones', async () => {
    const vague = await confidenceOf([sym('fatigue', 6), sym('headache', 6)]);
    const specific = await confidenceOf([sym('facial_droop', 6), sym('arm_weakness', 6)]);

    expect(specific).toBeGreaterThan(vague);
  });

  it('is lower for a symptom the table does not know', async () => {
    const known = await classifier.classify(episode([sym('cough', 4), sym('headache', 4)]));
    const unknown = await classifier.classify(episode([sym('cough', 4), sym('typed_freehand', 4)]));

    expect(unknown.severity).toBe(known.severity);
    expect(unknown.confidence).toBeLessThan(known.confidence);
  });

  it('drops near a band boundary', async () => {
    const samples = await Promise.all(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(async (sev) => {
        const r = await classifier.classify(episode([sym('fever', sev), sym('cough', sev)]));
        const distance = Math.min(
          Math.abs(r.severity - 25), Math.abs(r.severity - 55), Math.abs(r.severity - 80),
        );
        return { distance, confidence: r.confidence };
      }),
    );

    const near = samples.filter((s) => s.distance <= 2);
    const far = samples.filter((s) => s.distance >= 10);

    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);
    expect(Math.max(...near.map((s) => s.confidence)))
      .toBeLessThan(Math.max(...far.map((s) => s.confidence)));
  });

  it('stays inside honest bounds', async () => {
    const sweep = await Promise.all([
      confidenceOf([sym('runny_nose', 1)]),
      confidenceOf([sym('fatigue', 1), sym('unknown_thing', 1)]),
      confidenceOf(
        ['facial_droop', 'arm_weakness', 'speech_difficulty', 'chest_pain', 'breathlessness']
          .map((c) => sym(c, 10)),
      ),
    ]);

    for (const c of sweep) {
      expect(c).toBeGreaterThan(0.2);

      expect(c).toBeLessThanOrEqual(0.85);
    }
  });

  it('is zero with nothing to go on', async () => {
    expect(await confidenceOf([])).toBe(0);
  });
});

describe('confidence when a red flag decides the band', () => {
  const store: EpisodeStore = {
    init: async () => {},
    save: async () => {},
    all: async () => [],
    clear: async () => {},
  } as unknown as EpisodeStore;

  it('does not report 45% next to "call 111"', async () => {
    const useCase = new AssessSymptomsUseCase(classifier, store);

    const result = await useCase.execute(episode([
      sym('chest_pain', 8, 'Chest pain'),
      sym('breathlessness', 7, 'Breathlessness'),
    ]));

    expect(result.band).toBe('EMERGENCY');

    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('leaves confidence alone when no red flag fired', async () => {
    const useCase = new AssessSymptomsUseCase(classifier, store);
    const result = await useCase.execute(episode([sym('runny_nose', 2), sym('cough', 2)]));

    expect(result.band).not.toBe('EMERGENCY');
    expect(result.confidence).toBeLessThan(0.9);
  });
});
