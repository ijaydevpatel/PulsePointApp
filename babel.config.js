// babel-preset-expo ships as a dependency of `expo` and npm nested it under
// node_modules/expo/node_modules rather than hoisting it. Babel resolves preset
// names relative to this file, so the bare string 'babel-preset-expo' fails.
// Resolving through expo's own package location works regardless of hoisting.
const presetPath = require.resolve('babel-preset-expo', {
  paths: [require.resolve('expo/package.json')],
});

module.exports = function (api) {
  api.cache(true);
  return { presets: [presetPath] };
};
