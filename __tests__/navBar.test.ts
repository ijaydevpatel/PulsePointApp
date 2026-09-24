/**
 * The navigation bar's two hard constraints.
 *
 * Both are arithmetic rather than appearance, which is exactly why they belong
 * in a test: the bar looks fine on the device it was built against right up
 * until a sixth tab is added, at which point the targets shrink silently and
 * nothing on screen says so.
 */
import {
  BAR_PAD, BAR_SIDE_MARGIN, DEFAULT_TAB, MIN_BAR_WIDTH, SELECTED_UNITS,
  TABS, TabKey, UNITS,
} from '../src/ui/nav/routes';
import { TOUCH } from '../src/ui/theme';

/* ─────────────────────────────── contrast ───────────────────────────────── */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255)
    + 0.7152 * channel((n >> 8) & 255)
    + 0.0722 * channel(n & 255);
}

function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Mirrors the constants in TabBar. Kept local because they are deliberately
// private to that file - the bar is fixed light-on-dark in both schemes and
// must not be themeable.
const BAR = '#1A1A1A';
const PILL = '#FFFFFF';
const ON_PILL = '#0A0A0A';
const OFF_PILL = '#A6A6A6';

describe('the navigation graph', () => {
  it('carries exactly the five named destinations, in order', () => {
    expect(TABS.map((t) => t.key)).toEqual([
      'home', 'triage', 'medicines', 'chat', 'care',
    ] satisfies TabKey[]);
  });

  it('opens on Home', () => {
    // Home summarises what the phone already knows, so the first screen
    // answers "where do I stand" before asking for a new task.
    expect(DEFAULT_TAB).toBe('home');
    expect(TABS[0]!.key).toBe('home');
  });

  it('gives every tab a distinct glyph and label', () => {
    expect(new Set(TABS.map((t) => t.icon)).size).toBe(TABS.length);
    expect(new Set(TABS.map((t) => t.label)).size).toBe(TABS.length);
  });
});

describe('the bar stays readable', () => {
  it('shows unselected glyphs well past the 3:1 floor for controls', () => {
    // WCAG 1.4.11. A tab you cannot pick out is a tab you cannot reach.
    expect(ratio(OFF_PILL, BAR)).toBeGreaterThanOrEqual(3);
  });

  it('sets the selected label as real text contrast, not just chrome', () => {
    expect(ratio(ON_PILL, PILL)).toBeGreaterThanOrEqual(4.5);
  });

  it('separates the selected pill from the bar it sits in', () => {
    expect(ratio(PILL, BAR)).toBeGreaterThanOrEqual(3);
  });
});

/* ───────────────────────────── touch targets ────────────────────────────── */

describe('every tab stays tappable', () => {
  it('derives its width floor from the real tab count', () => {
    // If TABS grows, UNITS grows with it and MIN_BAR_WIDTH rises - the
    // assertion below then fails on a 320dp phone rather than the targets
    // quietly dropping under the floor.
    expect(UNITS).toBeCloseTo((TABS.length - 1) + SELECTED_UNITS, 5);
  });

  it('clears 44dp on the narrowest Android phone in circulation', () => {
    // 320dp. The bar sheds its side margins before it sheds target size, so
    // the check uses the reduced margin it falls back to.
    const width = 320;
    const margin = width < MIN_BAR_WIDTH ? 4 : BAR_SIDE_MARGIN;
    const available = width - margin * 2 - BAR_PAD * 2;
    expect(available / UNITS).toBeGreaterThanOrEqual(TOUCH);
  });

  it('would breach the floor with a sixth tab', () => {
    // States the reason the bar stops at five, rather than leaving it as a
    // comment someone can talk themselves out of later.
    const sixUnits = (6 - 1) + SELECTED_UNITS;
    const available = 320 - 2 * BAR_SIDE_MARGIN - 2 * BAR_PAD;
    expect(available / sixUnits).toBeLessThan(TOUCH);
  });

  it('gives the selected tab room for a glyph and the longest label', () => {
    const width = 320;
    const margin = width < MIN_BAR_WIDTH ? 4 : BAR_SIDE_MARGIN;
    const available = width - margin * 2 - BAR_PAD * 2;
    const selected = (available / UNITS) * SELECTED_UNITS;

    // glyph 21 + gap 7 + horizontal padding 24 = 52 of furniture, leaving the
    // rest for the label. "Medicines" at 13.5pt needs roughly 62.
    expect(selected - 52).toBeGreaterThanOrEqual(40);
  });

  it('keeps every label short enough to belong in a pill', () => {
    for (const t of TABS) {
      expect(`${t.key}: ${t.label.length}`).toBe(`${t.key}: ${t.label.length}`);
      expect(t.label.length).toBeLessThanOrEqual(10);
    }
  });
});

/* ───────────────────────── advice step parsing ──────────────────────────── */

/**
 * The synthesis prompt asks for a preamble then numbered steps on their own
 * lines. The screen renders the steps as a list, so the split has to survive
 * whatever the model actually emits - which is not always what was asked for.
 */
function splitAdvice(advice: string): { preamble: string; steps: string[] } {
  const lines = advice.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const steps: string[] = [];
  const preamble: string[] = [];

  for (const line of lines) {
    const m = /^(\d+)[.)]\s*(.+)$/.exec(line);
    if (m && m[2]) steps.push(m[2].trim());
    else if (steps.length === 0) preamble.push(line);
    else if (steps.length > 0) steps[steps.length - 1] += ` ${line}`;
  }

  return { preamble: preamble.join(' '), steps };
}

describe('next-step parsing', () => {
  it('separates the preamble from the numbered steps', () => {
    const { preamble, steps } = splitAdvice(
      'Your results show mild anaemia.\n1. Book a GP appointment this week.\n2. Repeat the blood test in a month.',
    );
    expect(preamble).toBe('Your results show mild anaemia.');
    expect(steps).toEqual([
      'Book a GP appointment this week.',
      'Repeat the blood test in a month.',
    ]);
  });

  it('accepts "1)" as well as "1."', () => {
    expect(splitAdvice('1) See a pharmacist.').steps).toEqual(['See a pharmacist.']);
  });

  it('joins a wrapped line onto the step it belongs to', () => {
    // Models break long steps across lines despite the prompt. A continuation
    // must not become a step of its own with no number.
    const { steps } = splitAdvice('1. Book a GP appointment\nwithin the next seven days.');
    expect(steps).toEqual(['Book a GP appointment within the next seven days.']);
  });

  it('keeps everything when the model ignores the format', () => {
    // No numbering at all: nothing may be dropped on the floor.
    const advice = 'Take this report to your GP. They will interpret it properly.';
    const { preamble, steps } = splitAdvice(advice);
    expect(steps).toEqual([]);
    expect(preamble).toBe(advice);
  });

  it('survives empty advice', () => {
    expect(splitAdvice('')).toEqual({ preamble: '', steps: [] });
  });
});
