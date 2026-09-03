/**
 * Babel configuration.
 *
 * Expo's Metro bundler has a built-in default config, which is why the SDK 57
 * template ships without this file. Jest does NOT: `babel-jest` needs a real
 * config on disk, otherwise it cannot parse the Flow type annotations inside
 * React Native's own packages (or the TypeScript in ours) and every test suite
 * fails with a SyntaxError.
 *
 * `babel-preset-expo` is the same preset Metro uses, so adding this file keeps
 * the app build and the test build consistent.
 */
module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
  };
};
