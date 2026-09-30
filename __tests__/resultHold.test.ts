/**
 * The result screen waits for the analysis before showing anything.
 *
 * ── Why ──────────────────────────────────────────────────────────────────────
 *
 * The score and confidence used to render immediately, with the conditions
 * filling in underneath. That is faster, and it made the number look
 * pre-decided: a finished 45/100 sitting above a spinner invites exactly one
 * conclusion, and on a triage screen that conclusion is fatal to trust even
 * when it is wrong.
 *
 * ── What keeps the wait from becoming its own hazard ─────────────────────────
 *
 * Two carve-outs, and both are the point of this file. An emergency is never
 * held behind a network call, and nothing is held forever.
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const SOURCE = readFileSync(
  join(__dirname, '..', 'src', 'ui', 'screens', 'ResultScreen.tsx'),
  'utf8',
);

describe('holding the result', () => {
  it('waits until the analysis has arrived', () => {
    expect(SOURCE).toMatch(/const \[revealed, setRevealed\] = useState\(/);
    expect(SOURCE).toMatch(/if \(!revealed && !escalate\) \{/);
  });

  it('never holds an emergency behind a network call', () => {
    /*
     * If the local engine has already matched a red flag, the advice to act
     * on it belongs on screen in the frame it was computed. A hosted call
     * that is slow, rate-limited or unreachable must not be able to delay
     * someone being told to ring 111.
     */
    const guard = /if \(!revealed && !escalate\) \{[\s\S]*?\n  \}/.exec(SOURCE)?.[0] ?? '';

    expect(guard).toContain('!escalate');
    expect(SOURCE).toContain('const escalate = requiresEscalation(result);');
  });

  it('gives up waiting rather than spinning forever', () => {
    /*
     * The hosted engine is allowed 90 seconds by the service. A screen that
     * waited that long would show a person nothing at all for a minute and a
     * half. After the deadline the local result is revealed regardless - it
     * was always complete.
     */
    const deadline = /const ANALYSIS_DEADLINE_MS = (\d+);/.exec(SOURCE)?.[1];

    expect(deadline).toBeDefined();
    expect(Number(deadline)).toBeGreaterThan(3000);
    expect(Number(deadline)).toBeLessThanOrEqual(20000);
    expect(SOURCE).toMatch(/setTimeout\(\(\) => setRevealed\(true\), ANALYSIS_DEADLINE_MS\)/);
  });

  it('leaks nothing about the outcome while waiting', () => {
    /*
     * A holding screen that showed the band colour, or a partial score, would
     * defeat the point of holding it.
     */
    const holding = /function Analysing\(\{[\s\S]*?\n\}/.exec(SOURCE)?.[0] ?? '';

    expect(holding.length).toBeGreaterThan(100);
    for (const leak of ['severity', 'result.band', 'BAND_LABEL', 'band.solid', 'confidence']) {
      expect(holding).not.toContain(leak);
    }
  });
});
