/**
 * Recovering a report the server could not parse.
 *
 * The failure it exists for: Gemini is capped at 2048 output tokens, a
 * multi-page medical record produces more synthesis than that, and the reply
 * is cut off part-way through a string. JSON.parse fails server-side and the
 * route answers 500 "Intelligence response could not be parsed" - while
 * handing back the model's text in `raw`.
 *
 * So the answer exists and has been paid for. These tests cover getting it
 * back, and the line that must not be crossed: structure is repaired, content
 * is never invented.
 */
import {
  salvageJson, isolateObject, repairTruncation, liftFields,
} from '../src/domain/salvageJson';
import { ApiClient, DEFAULT_TIMEOUT_MS } from '../src/data/apiClient';
import { RemoteReportAnalyzer } from '../src/data/remoteServices';

const KEYS = [
  'documentType', 'patientIdentity', 'findings',
  'abnormalMarkers', 'implications', 'advice', 'riskLevel',
] as const;

/** A reply cut off mid-sentence, exactly as the token cap leaves it. */
const TRUNCATED = `{
  "documentType": "Blood panel (diabetes screening)",
  "patientIdentity": "J. Patel, 67, Male",
  "findings": "HbA1c is 6.2%, above the laboratory normal of 6.0%.",
  "abnormalMarkers": ["Elevated HbA1c (6.2%)", "Elevated average blood glucose"],
  "implications": "Mild hyperglycaemia over the preceding 90 days.",
  "riskLevel": "Moderate",
  "advice": "Consult a general physician within 7 days to establish whether this`;

describe('salvaging a truncated report', () => {
  it('recovers every field that arrived intact', () => {
    const out = salvageJson(TRUNCATED, KEYS)!;

    expect(out).not.toBeNull();
    expect(out.documentType).toBe('Blood panel (diabetes screening)');
    expect(out.findings).toContain('6.2%');
    expect(out.riskLevel).toBe('Moderate');
    expect(out.abnormalMarkers).toEqual([
      'Elevated HbA1c (6.2%)', 'Elevated average blood glucose',
    ]);
  });

  it('keeps the half-written field as far as it got', () => {
    const out = salvageJson(TRUNCATED, KEYS)!;
    expect(String(out.advice)).toContain('Consult a general physician within 7 days');
  });

  it('does not invent the rest of a cut-off sentence', () => {
    /*
     * The one thing this must never do. Finishing a clinical sentence would
     * be the app writing medical advice and attributing it to the model.
     */
    const out = salvageJson(TRUNCATED, KEYS)!;
    const advice = String(out.advice);

    expect(advice.trim().endsWith('whether this')).toBe(true);
    expect(advice).not.toMatch(/diabetes|pre-diabetes|lifestyle/i);
  });

  it('handles a fenced reply with a preamble', () => {
    const fenced = 'Here is the analysis:\n```json\n{"findings":"All normal."}\n```';
    expect(salvageJson(fenced, KEYS)!.findings).toBe('All normal.');
  });

  it('handles reasoning tags, including an unclosed one', () => {
    const thinking = '<think>weighing the markers</think>{"findings":"Normal."}';
    expect(salvageJson(thinking, KEYS)!.findings).toBe('Normal.');

    const open = '<think>still weighing{"nonsense":1}';
    expect(salvageJson(open, KEYS)).toBeNull();
  });

  it('is not fooled by a brace inside a quoted value', () => {
    const tricky = '{"findings":"The value {abnormal} was noted","riskLevel":"Low"}';
    const out = salvageJson(tricky, KEYS)!;
    expect(out.findings).toBe('The value {abnormal} was noted');
    expect(out.riskLevel).toBe('Low');
  });

  it('returns null when there is nothing recognisable', () => {
    expect(salvageJson('The model refused to answer.', KEYS)).toBeNull();
    expect(salvageJson('', KEYS)).toBeNull();
    expect(salvageJson(undefined, KEYS)).toBeNull();
    expect(salvageJson(null, KEYS)).toBeNull();
  });

  it('closes only what was left open', () => {
    expect(repairTruncation('{"a":"b')).toBe('{"a":"b"}');
    expect(repairTruncation('{"a":["b","c"')).toBe('{"a":["b","c"]}');
    expect(repairTruncation('{"a":1,')).toBe('{"a":1}');
    // Already complete: untouched.
    expect(repairTruncation('{"a":"b"}')).toBe('{"a":"b"}');
  });

  it('keeps the whole object when there is no closing brace', () => {
    // Cutting at the last brace present would discard the fields that did
    // arrive, which is the opposite of the point.
    expect(isolateObject('{"a":"b", "c":"d')).toBe('{"a":"b", "c":"d');
  });

  it('lifts fields out of an object damaged in the middle', () => {
    const damaged = '{"documentType":"X-ray", ??? ,"riskLevel":"High"}';
    const out = liftFields(damaged, KEYS);
    expect(out.documentType).toBe('X-ray');
    expect(out.riskLevel).toBe('High');
  });
});

describe('the analyzer using it', () => {
  const FILE = { uri: 'file:///r.pdf', name: 'r.pdf', mimeType: 'application/pdf' };

  const serverFailing = (body: unknown, status = 500) => {
    const api = new ApiClient('https://example.test', DEFAULT_TIMEOUT_MS, (async () => ({
      ok: false, status,
      headers: { get: () => 'application/json' },
      json: async () => body,
    })) as any);
    api.setTokenProvider(async () => 'token');
    return new RemoteReportAnalyzer(api).analyze(FILE);
  };

  it('turns the 500 the user actually saw into a report', async () => {
    const out = await serverFailing({
      message: 'Intelligence response could not be parsed.',
      raw: TRUNCATED,
    });

    expect(out.status).toBe('OK');
    expect(out.data?.documentType).toBe('Blood panel (diabetes screening)');
    expect(out.data?.abnormalMarkers).toHaveLength(2);
    expect(out.data?.riskLevel).toBe('Moderate');
  });

  it('still fails honestly when raw is unusable', async () => {
    const out = await serverFailing({
      message: 'Intelligence response could not be parsed.',
      raw: 'I cannot read this document.',
    });

    expect(out.status).not.toBe('OK');
    expect(out.notice).toContain('could not be parsed');
  });

  it('does not salvage anything from an error with no raw', async () => {
    const out = await serverFailing({ message: 'Report Analysis Fault: quota exceeded.' });

    expect(out.status).not.toBe('OK');
    expect(out.data).toBeNull();
  });
});
