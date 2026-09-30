import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const UI = join(__dirname, '..', 'src', 'ui');
const SCREENS = join(UI, 'screens');

const screens = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'));
const read = (f: string) => readFileSync(join(SCREENS, f), 'utf8');
const files = screens;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return sources(full);
    return e.name.endsWith('.tsx') || e.name.endsWith('.ts') ? [full] : [];
  });
}

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const withInputs = screens.filter((f) => /<TextInput/.test(read(f)));

function navCards(source: string): { before: string }[] {
  const lines = source.split('\n');
  const found: { before: string }[] = [];

  lines.forEach((line, i) => {
    if (!/^\s*<NavCard\b/.test(line)) return;
    found.push({ before: lines[i - 1] ?? '' });
  });

  return found;
}

const uiFiles = sources(UI);

describe('no liquid glass', () => {
  it('reads the whole of src/ui, so this cannot pass vacuously', () => {
    expect(uiFiles.length).toBeGreaterThan(15);
  });

  it('has no LiquidGlass component to import', () => {
    expect(existsSync(join(UI, 'components', 'LiquidGlass.tsx'))).toBe(false);
  });

  it.each(uiFiles.map((f) => [f.slice(UI.length + 1), f] as const))(
    '%s uses no glass surface',
    (_name, full) => {
      const code = stripComments(readFileSync(full, 'utf8'));

      expect(code).not.toMatch(/<LiquidGlass\b/);
      expect(code).not.toMatch(/<GlassCircle\b/);
      expect(code).not.toMatch(/<GlassBackground\b/);
      expect(code).not.toMatch(/glass=\{true\}/);
      expect(code).not.toMatch(/tone="glass"/);
    },
  );

  it('does not reach for expo-blur again', () => {
    for (const f of uiFiles) {
      expect(stripComments(readFileSync(f, 'utf8'))).not.toContain('expo-blur');
    }
  });
});

describe('NavCard spacing', () => {
  it('finds the screens that stack navigation rows', () => {
    const total = files.reduce((n, f) => n + navCards(read(f)).length, 0);
    expect(total).toBeGreaterThanOrEqual(6);
  });

  it.each(files)('%s gives every NavCard a spacer', (file) => {
    for (const { before } of navCards(read(file))) {
      expect(before).toMatch(/marginBottom/);
    }
  });
});

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
