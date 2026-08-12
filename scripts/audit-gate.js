/**
 * Dependency audit gate.
 *
 * `npm audit` counts the whole build toolchain, so a raw number tells you very
 * little about whether users are exposed. This gate asks the question that
 * matters: can a finding reach someone running the app?
 *
 * It FAILS the build on any high or critical finding that is not on the
 * documented exception list, and prints the exceptions every run so they cannot
 * quietly rot.
 */
const { execSync } = require('child_process');

/**
 * Known, justified exceptions. Each needs a reason and a review date - if you
 * cannot write those, it is not an exception, it is an unfixed bug.
 */
const EXCEPTIONS = [
  {
    name: 'image-size',
    reason:
      'No fixed version exists. Latest published (2.0.2) is still inside the ' +
      'vulnerable range; there is no 3.x. Used by the Metro bundler at build ' +
      'time to read asset dimensions. Not imported by app code, so it is not ' +
      'in the APK. Exploiting it would mean feeding a hostile image to your ' +
      'own build machine.',
    review: '2026-09-15',
  },
];

function audit() {
  try {
    return JSON.parse(execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch (e) {
    // npm audit exits non-zero when findings exist; the JSON is still on stdout.
    return JSON.parse(e.stdout || '{"vulnerabilities":{}}');
  }
}

const vulns = audit().vulnerabilities || {};
const roots = new Map();
for (const v of Object.values(vulns)) {
  for (const via of v.via || []) {
    if (typeof via === 'object' && via.name) roots.set(via.name, via.severity);
  }
}

const excepted = new Set(EXCEPTIONS.map((e) => e.name));
const blocking = [...roots.entries()].filter(
  ([name, sev]) => !excepted.has(name) && (sev === 'high' || sev === 'critical'),
);

console.log(`\nAudit: ${Object.keys(vulns).length} affected packages from ${roots.size} upstream advisories.\n`);

if (EXCEPTIONS.length) {
  console.log('Accepted exceptions:');
  for (const e of EXCEPTIONS) {
    const stale = new Date(e.review) < new Date();
    console.log(`  ${stale ? '[REVIEW OVERDUE]' : '[ok]'} ${e.name} (review by ${e.review})`);
    console.log(`      ${e.reason.replace(/\s+/g, ' ')}`);
    if (stale) console.log('      -> Check whether upstream has published a fix.');
  }
  console.log('');
}

if (blocking.length) {
  console.error('FAIL: unaccepted high/critical findings:');
  for (const [name, sev] of blocking) console.error(`  ${sev.toUpperCase()} ${name}`);
  console.error('\nFix them, or add a documented exception with a reason and review date.');
  process.exit(1);
}

console.log('PASS: no unaccepted high or critical findings.\n');
