/**
 * Every screen with a text field has to handle the keyboard itself.
 *
 * ── The bug this pins ────────────────────────────────────────────────────────
 *
 * Android used to do this for us. `adjustResize` shrank the window when the
 * keyboard opened, a ScrollView got shorter, and the focused field was
 * scrolled into what was left. So every screen here was written as
 * `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` - iOS needed
 * help, Android did not - and two screens were written with no keyboard
 * handling at all.
 *
 * Edge-to-edge ended that. The window no longer resizes; the keyboard is an
 * inset laid over the app. The Android branch of every one of those
 * expressions became a branch that does nothing, and any field in the lower
 * half of the screen was typed into blind.
 *
 * The failure mode is what makes this worth a test: nothing errors, nothing
 * logs, and it is invisible on a simulator if you are testing with a hardware
 * keyboard. It comes back the moment someone adds a screen by copying an
 * existing one.
 */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SCREENS = join(__dirname, '..', 'src', 'ui', 'screens');

const screens = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'));
const read = (f: string) => readFileSync(join(SCREENS, f), 'utf8');

/** Screens that actually take typed input. */
const withInputs = screens.filter((f) => /<TextInput/.test(read(f)));

describe('keyboard handling', () => {
  it('finds the screens that have text fields', () => {
    // Guards the two tests below against passing because the glob broke.
    expect(withInputs.length).toBeGreaterThanOrEqual(3);
  });

  it.each(withInputs)('%s keeps its fields clear of the keyboard', (file) => {
    const source = read(file);

    /*
     * Either the shared wrapper, or - for the Map tab, whose field sits in a
     * sheet it can simply raise instead - a deliberate focus handler. What is
     * not acceptable is neither.
     */
    const handled = source.includes('KeyboardSafe')
      || /onFocus=\{\(\) => settle\(0\)\}/.test(source);

    expect(handled).toBe(true);
  });

  it.each(screens)('%s has no Android branch that does nothing', (file) => {
    const source = read(file);

    // The exact expression that stopped working, in all its spellings.
    expect(source).not.toMatch(/behavior=\{\s*Platform\.OS === ['"]ios['"]\s*\?/);
  });

  it('does not reach for KeyboardAvoidingView again', () => {
    /*
     * Not a style preference. Its Android path was rarely exercised, because
     * Android rarely needed it, and under edge-to-edge it measures against a
     * window that is not changing size. Reading the height from the event
     * that announces the keyboard is the thing that is actually true.
     */
    for (const file of screens) {
      expect(read(file)).not.toContain('<KeyboardAvoidingView');
    }
  });
});

describe('the Android manifest', () => {
  it('still asks for the resize layout mode', () => {
    // Belt and braces with KeyboardSafe: it is what non-edge-to-edge Android
    // versions and any future opt-out will use.
    const app = JSON.parse(
      readFileSync(join(__dirname, '..', 'app.json'), 'utf8'),
    );

    expect(app.expo.android.softwareKeyboardLayoutMode).toBe('resize');
  });
});
