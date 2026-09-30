import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const UI = join(__dirname, '..', 'src', 'ui');

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return sources(full);
    return e.name.endsWith('.tsx') || e.name.endsWith('.ts') ? [full] : [];
  });
}

const files = sources(UI);
const read = (f: string) => readFileSync(f, 'utf8');

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('no liquid glass', () => {
  it('reads the whole of src/ui, so this cannot pass vacuously', () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it('has no LiquidGlass component to import', () => {
    expect(existsSync(join(UI, 'components', 'LiquidGlass.tsx'))).toBe(false);
  });

  it.each(files.map((f) => [f.slice(UI.length + 1), f] as const))(
    '%s uses no glass surface',
    (_name, full) => {
      const code = stripComments(read(full));

      expect(code).not.toMatch(/<LiquidGlass\b/);
      expect(code).not.toMatch(/<GlassCircle\b/);
      expect(code).not.toMatch(/<GlassBackground\b/);
      expect(code).not.toMatch(/glass=\{true\}/);
      expect(code).not.toMatch(/tone="glass"/);
    },
  );

  it('does not reach for expo-blur again', () => {
    for (const f of files) {
      expect(stripComments(read(f))).not.toContain('expo-blur');
    }
  });
});
