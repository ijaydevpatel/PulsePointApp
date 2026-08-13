/**
 * Make debug builds self-contained.
 *
 * React Native skips JS bundling for variants listed in `debuggableVariants`,
 * which defaults to ["debug"]. That is why a debug APK shows
 * "Unable to load script ... index.android.bundle" unless Metro is running.
 *
 * Setting it to [] makes the debug APK bundle the JS like a release build, so
 * the app opens straight into Triage with nothing else running. Debug builds
 * get ~30s slower because Metro now runs at build time. That is the trade.
 *
 * android/ is generated, so this must be re-run after `expo prebuild`.
 * `npm run prebuild` and reset.bat both call it.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
if (!fs.existsSync(file)) {
  console.error('android/app/build.gradle not found - run expo prebuild first.');
  process.exit(1);
}

let src = fs.readFileSync(file, 'utf8');

if (src.includes('debuggableVariants = []')) {
  console.log('JS bundling in debug: already enabled.');
  process.exit(0);
}

// Insert just inside the react { } block.
const marker = 'react {\n';
const i = src.indexOf(marker);
if (i === -1) {
  console.error('Could not find the react { } block.');
  process.exit(1);
}

const insert =
  '    // Bundle JS into debug APKs so the app runs without Metro.\n' +
  '    // Applied by scripts/bundle-js-in-debug.js - re-run after prebuild.\n' +
  '    debuggableVariants = []\n\n';

src = src.slice(0, i + marker.length) + insert + src.slice(i + marker.length);
fs.writeFileSync(file, src);
console.log('JS bundling in debug: enabled.');
