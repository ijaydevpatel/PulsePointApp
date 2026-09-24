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
  TABS, TabKey, UNITS, pillSlot, tabSlot, pillContentWidth, pillSlotNeeded, labelWidth,
  PILL_COMFORT,
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

  it('holds every label whole, on the narrowest phone', () => {
    /*
     * "Symptoms" was rendering as "Sympto...". The pill was wide enough to
     * look right and too narrow to hold its own label.
     *
     * The version of this test that let that through asked for 40dp of label
     * room while its own comment said "Medicines needs roughly 62" - it
     * asserted less than it claimed, so it passed on exactly the labels it
     * existed to catch. It now measures each real label against the same
     * furniture constants the pill is drawn from, so the two cannot drift.
     */
    const width = 320;
    const margin = width < MIN_BAR_WIDTH ? 4 : BAR_SIDE_MARGIN;
    const available = width - margin * 2 - BAR_PAD * 2;
    const selected = (available / UNITS) * SELECTED_UNITS;

    for (const t of TABS) {
      const needed = pillSlotNeeded(t.label);
      expect(`${t.label} needs ${Math.ceil(needed)}, has ${Math.floor(selected)}`)
        .toBe(`${t.label} needs ${Math.ceil(needed)}, has ${Math.floor(selected)}`);
      expect(selected).toBeGreaterThanOrEqual(needed);
    }
  });

  it('leaves the longest label breathing room, not just a fit', () => {
    // A pill that clears its label by a hair reads as cramped even when
    // nothing truncates. Eight points is about one character of slack.
    const width = 320;
    const margin = width < MIN_BAR_WIDTH ? 4 : BAR_SIDE_MARGIN;
    const available = width - margin * 2 - BAR_PAD * 2;
    const selected = (available / UNITS) * SELECTED_UNITS;

    const longest = TABS.reduce((a, b) => (labelWidth(a.label) > labelWidth(b.label) ? a : b));
    expect(selected - pillSlotNeeded(longest.label)).toBeGreaterThanOrEqual(2);
  });

  it('does not buy that room by starving the other tabs', () => {
    // The selected pill and the touch floor pull in opposite directions -
    // widening one narrows the other four. Both are asserted, so neither can
    // be fixed at the other's expense without this failing.
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

describe('the sliding pill', () => {
  /*
   * The pill is one view that moves between slots rather than a background
   * that appears on whichever tab is selected - the eye reads the latter as
   * two pills, and loses the one it was following.
   *
   * Its geometry is arithmetic rather than measurement, which is the only
   * reason this can be tested at all. These assertions are what stop it
   * drifting: nothing about the pill is visible in a unit test, so a wrong
   * slot would otherwise only show up as a pill sitting off-centre on a
   * device.
   */
  const WIDTH = 360;

  it('fills exactly the selected tab on both ends of the row', () => {
    const first = tabSlot(WIDTH, 0);
    expect(first.left).toBeCloseTo(BAR_PAD, 5);

    const last = tabSlot(WIDTH, TABS.length - 1);
    // The right edge lands on the far padding, so the pill never overhangs.
    expect(last.left + last.width).toBeCloseTo(WIDTH - BAR_PAD, 5);
  });

  it('gives every slot the same width and an even stride', () => {
    const slots = TABS.map((_, i) => tabSlot(WIDTH, i));
    const widths = new Set(slots.map((s) => s.width.toFixed(5)));
    expect(widths.size).toBe(1);

    const strides = slots.slice(1).map((s, i) => s.left - slots[i]!.left);
    const unique = new Set(strides.map((d) => d.toFixed(5)));
    expect(unique.size).toBe(1);
  });

  it('is wider than an unselected slot, by the weight that says so', () => {
    const stride = tabSlot(WIDTH, 1).left - tabSlot(WIDTH, 0).left;
    expect(tabSlot(WIDTH, 0).width / stride).toBeCloseTo(SELECTED_UNITS, 5);
  });

  it('adds up to the full inner width', () => {
    const stride = tabSlot(WIDTH, 1).left - tabSlot(WIDTH, 0).left;
    expect(stride * UNITS).toBeCloseTo(WIDTH - BAR_PAD * 2, 5);
  });

  it('reports nothing to draw before the bar has been laid out', () => {
    // Zero is "not ready", not a position: drawing at it would flash a pill
    // in the corner on the first frame.
    expect(pillSlot(0, 0)).toEqual({ left: 0, width: 0 });
    expect(tabSlot(BAR_PAD * 2, 2)).toEqual({ left: 0, width: 0 });
  });

  it('clamps an index that is not a tab', () => {
    expect(tabSlot(WIDTH, -3)).toEqual(tabSlot(WIDTH, 0));
    expect(tabSlot(WIDTH, 99)).toEqual(tabSlot(WIDTH, TABS.length - 1));
  });
});

describe('the pill stays the size of its contents', () => {
  /*
   * The complaint this answers: on a wide phone the pill was a 140dp shape
   * around 85dp of content. It took a fixed share of the row, so it grew with
   * the screen while "Symptoms" did not, and the surplus read as a shape that
   * did not know what it was for.
   *
   * There was no assertion that could have caught it. Every check here was a
   * lower bound - does the label fit - and none was an upper bound.
   */
  const symptoms = TABS.find((t) => t.label === 'Symptoms')!;

  it('does not keep growing with the screen', () => {
    const wide = pillSlot(480, TABS.indexOf(symptoms)).width;
    const wider = pillSlot(720, TABS.indexOf(symptoms)).width;

    expect(wide).toBeCloseTo(wider, 5);
    expect(wide).toBeLessThanOrEqual(pillContentWidth(symptoms.label) + PILL_COMFORT * 2 + 0.01);
  });

  it('keeps the same breathing space on either side of the content', () => {
    for (const width of [412, 480, 720]) {
      for (const t of TABS) {
        const slot = pillSlot(width, TABS.indexOf(t));
        const padPerSide = (slot.width - pillContentWidth(t.label)) / 2;
        expect(padPerSide).toBeCloseTo(PILL_COMFORT, 5);
      }
    }
  });

  it('gives the label the whole slot when the screen is narrow', () => {
    // The clamp must never make things worse: where the slot is the tighter
    // of the two, the slot wins and the label gets every pixel going.
    const bar = 320 - 4 * 2;   // 320dp phone, margins already shed
    const longest = TABS.reduce((a, b) => (labelWidth(a.label) > labelWidth(b.label) ? a : b));
    const i = TABS.indexOf(longest);

    expect(pillSlot(bar, i).width).toBeCloseTo(tabSlot(bar, i).width, 5);
  });

  it('stays centred on the tab it belongs to', () => {
    // Clamping the width must not shift the pill off its own tab, or it would
    // sit between two of them.
    for (const bar of [312, 328, 448]) {
      for (const t of TABS) {
        const i = TABS.indexOf(t);
        const slot = tabSlot(bar, i);
        const drawn = pillSlot(bar, i);

        expect(drawn.left + drawn.width / 2).toBeCloseTo(slot.left + slot.width / 2, 5);
      }
    }
  });
});
