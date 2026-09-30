import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const UI = join(__dirname, '..', 'src', 'ui');
const HOOK = 'useReveal.ts';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sources(full);
    return /\.tsx?$/.test(name) && name !== HOOK ? [full] : [];
  });
}

describe('animation', () => {
  const files = sources(UI);

  it('finds UI sources to check', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [f.slice(UI.length + 1), f]))(
    '%s keeps useReveal objects out of dependency arrays',
    (_name, path) => {
      const src = readFileSync(path as string, 'utf8');

      const bound = [...src.matchAll(/const\s+(\w+)\s*=\s*useReveal\(/g)].map((m) => m[1]);
      if (bound.length === 0) return;

      const deps = [...src.matchAll(/\}\s*,\s*\[([^\]]*)\]\s*\)/g)].map((m) => m[1]);

      for (const name of bound) {
        for (const list of deps) {
          expect(list).not.toMatch(new RegExp(`\\b${name}\\b`));
        }
      }
    },
  );

  it.each(files.map((f) => [f.slice(UI.length + 1), f]))(
    '%s animates only through useReveal',
    (_name, path) => {
      const src = readFileSync(path as string, 'utf8');

      expect(src).not.toMatch(/useNativeDriver:\s*true/);

    },
  );
});
