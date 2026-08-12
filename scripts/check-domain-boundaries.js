/**
 * Evaluation criterion E3: the domain layer must import no React, no SQLite,
 * no network client and no React Native. This is the machine-checkable form of
 * guiding requirement L2. Run in CI; fails the build on violation.
 */
const fs = require('fs');
const path = require('path');

const DOMAIN = path.join(__dirname, '..', 'src', 'domain');
const FORBIDDEN = [
  /from\s+['"]react['"]/, /from\s+['"]react-native/, /from\s+['"]expo/,
  /from\s+['"].*sqlite/i, /from\s+['"]axios['"]/, /\bfetch\s*\(/,
  /from\s+['"]\.\.\/data\//, /from\s+['"]\.\.\/ui\//,
];

let violations = 0;
for (const file of fs.readdirSync(DOMAIN).filter((f) => f.endsWith('.ts'))) {
  const src = fs.readFileSync(path.join(DOMAIN, file), 'utf8');
  src.split('\n').forEach((line, i) => {
    for (const rule of FORBIDDEN) {
      if (rule.test(line)) {
        console.error(`E3 VIOLATION  src/domain/${file}:${i + 1}\n    ${line.trim()}`);
        violations++;
      }
    }
  });
}

if (violations > 0) {
  console.error(`\nFAIL: ${violations} domain-boundary violation(s). See requirement L2.`);
  process.exit(1);
}
console.log('E3 PASS: domain layer has no platform, UI or network dependencies.');
