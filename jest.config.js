/**
 * Jest configuration.
 *
 * Uses the single-platform `jest-expo/ios` preset rather than the multi-project
 * `jest-expo` preset: our tests target platform-independent logic (services,
 * domain schemas, safety rules), so running each suite three times over
 * ios/android/web would only slow the feedback loop down.
 *
 * iOS is the chosen platform because that is the device this project is
 * developed and demonstrated on, so `Platform.OS` in tests matches reality.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'jest-expo/ios',
  // Mirror the `@/*` path alias from tsconfig.json.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/__tests__/**/*.test.ts', '<rootDir>/__tests__/**/*.test.tsx'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/app/**'],
  clearMocks: true,
};
