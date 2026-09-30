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
    const guard = /if \(!revealed && !escalate\) \{[\s\S]*?\n  \}/.exec(SOURCE)?.[0] ?? '';

    expect(guard).toContain('!escalate');
    expect(SOURCE).toContain('const escalate = requiresEscalation(result);');
  });

  it('gives up waiting rather than spinning forever', () => {
    const deadline = /const ANALYSIS_DEADLINE_MS = (\d+);/.exec(SOURCE)?.[1];

    expect(deadline).toBeDefined();
    expect(Number(deadline)).toBeGreaterThan(3000);
    expect(Number(deadline)).toBeLessThanOrEqual(20000);
    expect(SOURCE).toMatch(/setTimeout\(\(\) => setRevealed\(true\), ANALYSIS_DEADLINE_MS\)/);
  });

  it('leaks nothing about the outcome while waiting', () => {
    const holding = /function Analysing\(\{[\s\S]*?\n\}/.exec(SOURCE)?.[0] ?? '';

    expect(holding.length).toBeGreaterThan(100);
    for (const leak of ['severity', 'result.band', 'BAND_LABEL', 'band.solid', 'confidence']) {
      expect(holding).not.toContain(leak);
    }
  });
});
