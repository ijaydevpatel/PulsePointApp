import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SCREENS = join(__dirname, '..', 'src', 'ui', 'screens');

const screens = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'));
const read = (f: string) => readFileSync(join(SCREENS, f), 'utf8');

const withInputs = screens.filter((f) => /<TextInput/.test(read(f)));

describe('keyboard handling', () => {
  it('finds the screens that have text fields', () => {
    expect(withInputs.length).toBeGreaterThanOrEqual(3);
  });

  it.each(withInputs)('%s keeps its fields clear of the keyboard', (file) => {
    const source = read(file);

    const handled = source.includes('KeyboardSafe')
      || /onFocus=\{\(\) => settle\(0\)\}/.test(source);

    expect(handled).toBe(true);
  });

  it.each(screens)('%s has no Android branch that does nothing', (file) => {
    const source = read(file);

    expect(source).not.toMatch(/behavior=\{\s*Platform\.OS === ['"]ios['"]\s*\?/);
  });

  it('does not reach for KeyboardAvoidingView again', () => {
    for (const file of screens) {
      expect(read(file)).not.toContain('<KeyboardAvoidingView');
    }
  });
});

describe('the Android manifest', () => {
  it('still asks for the resize layout mode', () => {
    const app = JSON.parse(
      readFileSync(join(__dirname, '..', 'app.json'), 'utf8'),
    );

    expect(app.expo.android.softwareKeyboardLayoutMode).toBe('resize');
  });
});
