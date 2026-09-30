import {
  BAR_PAD, BAR_SIDE_MARGIN, DEFAULT_TAB, MIN_BAR_WIDTH, SELECTED_UNITS,
  TABS, TabKey, UNITS, pillSlot, pillContentWidth, labelWidth,
} from '../src/ui/nav/routes';
import { TOUCH } from '../src/ui/theme';

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
    expect(ratio(OFF_PILL, BAR)).toBeGreaterThanOrEqual(3);
  });

  it('sets the selected label as real text contrast, not just chrome', () => {
    expect(ratio(ON_PILL, PILL)).toBeGreaterThanOrEqual(4.5);
  });

  it('separates the selected pill from the bar it sits in', () => {
    expect(ratio(PILL, BAR)).toBeGreaterThanOrEqual(3);
  });
});

describe('every tab stays tappable', () => {
  it('derives its width floor from the real tab count', () => {
    expect(UNITS).toBeCloseTo((TABS.length - 1) + SELECTED_UNITS, 5);
  });

  it('clears 44dp on the narrowest Android phone in circulation', () => {
    const width = 320;
    const margin = width < MIN_BAR_WIDTH ? 4 : BAR_SIDE_MARGIN;
    const available = width - margin * 2 - BAR_PAD * 2;
    expect(available / UNITS).toBeGreaterThanOrEqual(TOUCH);
  });

  it('would breach the floor with a sixth tab', () => {
    const sixUnits = (6 - 1) + SELECTED_UNITS;
    const available = 320 - 2 * BAR_SIDE_MARGIN - 2 * BAR_PAD;
    expect(available / sixUnits).toBeLessThan(TOUCH);
  });

  it('holds every label whole, on the narrowest phone', () => {
    const width = 320;
    const margin = width < MIN_BAR_WIDTH ? 4 : BAR_SIDE_MARGIN;
    const available = width - margin * 2 - BAR_PAD * 2;
    const selected = (available / UNITS) * SELECTED_UNITS;

    for (const t of TABS) {
      const needed = pillContentWidth(t.label);
      expect(`${t.label} needs ${Math.ceil(needed)}, has ${Math.floor(selected)}`)
        .toBe(`${t.label} needs ${Math.ceil(needed)}, has ${Math.floor(selected)}`);
      expect(selected).toBeGreaterThanOrEqual(needed);
    }
  });

  it('leaves the longest label breathing room, not just a fit', () => {
    const width = 320;
    const margin = width < MIN_BAR_WIDTH ? 4 : BAR_SIDE_MARGIN;
    const available = width - margin * 2 - BAR_PAD * 2;
    const selected = (available / UNITS) * SELECTED_UNITS;

    const longest = TABS.reduce((a, b) => (labelWidth(a.label) > labelWidth(b.label) ? a : b));
    expect(selected - pillContentWidth(longest.label)).toBeGreaterThanOrEqual(4);
  });

  it('does not buy that room by starving the other tabs', () => {
    const available = 320 - 4 * 2 - BAR_PAD * 2;
    expect(available / UNITS).toBeGreaterThanOrEqual(TOUCH);
  });

  it('keeps every label short enough to belong in a pill', () => {
    for (const t of TABS) {
      expect(`${t.key}: ${t.label.length}`).toBe(`${t.key}: ${t.label.length}`);
      expect(t.label.length).toBeLessThanOrEqual(10);
    }
  });
});

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
    const { steps } = splitAdvice('1. Book a GP appointment\nwithin the next seven days.');
    expect(steps).toEqual(['Book a GP appointment within the next seven days.']);
  });

  it('keeps everything when the model ignores the format', () => {
    const advice = 'Take this report to your GP. They will interpret it properly.';
    const { preamble, steps } = splitAdvice(advice);
    expect(steps).toEqual([]);
    expect(preamble).toBe(advice);
  });

  it('survives empty advice', () => {
    expect(splitAdvice('')).toEqual({ preamble: '', steps: [] });
  });
});

describe('the sliding pill', () => {
  const WIDTH = 360;

  it('fills exactly the selected tab on both ends of the row', () => {
    const first = pillSlot(WIDTH, 0);
    expect(first.left).toBeCloseTo(BAR_PAD, 5);

    const last = pillSlot(WIDTH, TABS.length - 1);

    expect(last.left + last.width).toBeCloseTo(WIDTH - BAR_PAD, 5);
  });

  it('gives every slot the same width and an even stride', () => {
    const slots = TABS.map((_, i) => pillSlot(WIDTH, i));
    const widths = new Set(slots.map((s) => s.width.toFixed(5)));
    expect(widths.size).toBe(1);

    const strides = slots.slice(1).map((s, i) => s.left - slots[i]!.left);
    const unique = new Set(strides.map((d) => d.toFixed(5)));
    expect(unique.size).toBe(1);
  });

  it('is wider than an unselected slot, by the weight that says so', () => {
    const stride = pillSlot(WIDTH, 1).left - pillSlot(WIDTH, 0).left;
    expect(pillSlot(WIDTH, 0).width / stride).toBeCloseTo(SELECTED_UNITS, 5);
  });

  it('adds up to the full inner width', () => {
    const stride = pillSlot(WIDTH, 1).left - pillSlot(WIDTH, 0).left;
    expect(stride * UNITS).toBeCloseTo(WIDTH - BAR_PAD * 2, 5);
  });

  it('reports nothing to draw before the bar has been laid out', () => {
    expect(pillSlot(0, 0)).toEqual({ left: 0, width: 0 });
    expect(pillSlot(BAR_PAD * 2, 2)).toEqual({ left: 0, width: 0 });
  });

  it('clamps an index that is not a tab', () => {
    expect(pillSlot(WIDTH, -3)).toEqual(pillSlot(WIDTH, 0));
    expect(pillSlot(WIDTH, 99)).toEqual(pillSlot(WIDTH, TABS.length - 1));
  });
});
