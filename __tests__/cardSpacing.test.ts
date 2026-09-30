import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SCREENS = join(__dirname, '..', 'src', 'ui', 'screens');
const files = readdirSync(SCREENS).filter((f) => f.endsWith('.tsx'));
const read = (f: string) => readFileSync(join(SCREENS, f), 'utf8');

function navCards(source: string): { before: string }[] {
  const lines = source.split('\n');
  const found: { before: string }[] = [];

  lines.forEach((line, i) => {
    if (!/^\s*<NavCard\b/.test(line)) return;
    found.push({ before: lines[i - 1] ?? '' });
  });

  return found;
}

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
