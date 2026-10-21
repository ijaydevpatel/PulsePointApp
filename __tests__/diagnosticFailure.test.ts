import { isDiagnosticFailure } from '../src/domain/remote';

/*
 * The backend answers 200 OK when its model fails and puts the failure in the
 * payload. Observed on a device on 21 Oct 2026: a condition named "Diagnostic
 * Synthesis Error" at 10%, a synopsis about a syntax error, and treatment
 * entries reading "Neural engine returned unformatted data". The screen showed
 * all of it as if it were a finding, which QR2 forbids.
 */

describe('the backend failure sentinel is recognised', () => {
  it('spots it in the synopsis', () => {
    expect(isDiagnosticFailure(
      'The AI model encountered a syntax error while generating the diagnostic matrix. This is typically transient. Please try again.',
    )).toBe(true);
  });

  it('spots it in a condition name', () => {
    expect(isDiagnosticFailure('', ['Diagnostic Synthesis Error'])).toBe(true);
  });

  it('spots it in the treatment list', () => {
    expect(isDiagnosticFailure('', [], ['Neural engine returned unformatted data. Please re-run analysis.']))
      .toBe(true);
  });

  it('spots it wherever it appears, not only the first field', () => {
    expect(isDiagnosticFailure('A normal synopsis.', ['Migraine with Aura'], ['Unformatted data']))
      .toBe(true);
  });
});

describe('a real analysis is left alone', () => {
  it('passes the stroke response that the report quotes', () => {
    expect(isDiagnosticFailure(
      'Facial droop with confusion points toward a neurological event, often a stroke.',
      ['Ischemic Stroke', 'Intracranial Hemorrhage', "Bell's Palsy"],
      ['Alteplase 0.9mg/kg IV', 'Aspirin 325mg', 'Apply a cold compress'],
    )).toBe(false);
  });

  it('treats an empty response as not-a-sentinel, since the caller checks that', () => {
    expect(isDiagnosticFailure('', [], [])).toBe(false);
    expect(isDiagnosticFailure(undefined)).toBe(false);
  });

  it('does not fire on ordinary clinical words', () => {
    expect(isDiagnosticFailure(
      'A diagnostic workup is advised. Errors in technique can affect the reading.',
      ['Diagnostic uncertainty'],
      ['Review the data with a clinician'],
    )).toBe(false);
  });
});
