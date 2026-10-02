const { withGradleProperties } = require('@expo/config-plugins');

/*
 * android/ is generated and git-ignored, so anything written into
 * android/gradle.properties by hand is lost on the next prebuild and is never
 * visible to anyone who clones the repository. This re-applies the build
 * settings every time the native project is generated.
 *
 * These affect build time only; nothing here changes what the app does at
 * runtime. No before-and-after build timing has been recorded.
 */

const PROPERTIES = [
  // SQLCipher's CMake step and the React Native compile both need headroom.
  ['org.gradle.jvmargs', '-Xmx4096m -XX:MaxMetaspaceSize=512m -XX:+UseG1GC'],
  // Reuse task outputs so unchanged modules are not rebuilt.
  ['org.gradle.caching', 'true'],
  // Avoid re-scanning the working tree between builds on Windows.
  ['org.gradle.vfs.watch', 'true'],
  // Keep the daemon warm between builds.
  ['org.gradle.daemon', 'true'],
  // Recompile only the Kotlin files that changed.
  ['kotlin.incremental', 'true'],
];

/** Replaces the value if the key is already set, otherwise appends it. */
function upsert(items, key, value) {
  const existing = items.find((i) => i.type === 'property' && i.key === key);
  if (existing) {
    existing.value = value;
    return items;
  }
  items.push({ type: 'property', key, value });
  return items;
}

const withBuildPerformance = (config) =>
  withGradleProperties(config, (cfg) => {
    for (const [key, value] of PROPERTIES) {
      cfg.modResults = upsert(cfg.modResults, key, value);
    }
    return cfg;
  });

module.exports = withBuildPerformance;
module.exports.PROPERTIES = PROPERTIES;
module.exports.upsert = upsert;
