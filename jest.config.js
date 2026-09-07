/**
 * Two projects, because the two layers have genuinely different needs:
 *
 *   db  - the ledger logic, in plain Node against node:sqlite. No device, no
 *         emulator, no React. This is where correctness is actually proven.
 *   ui  - component tests through jest-expo.
 *
 * Layer C (the real Android phone) is manual and lives in docs/test-plan.md.
 */
module.exports = {
  projects: [
    {
      displayName: 'db',
      preset: 'jest-expo/node',
      testMatch: ['<rootDir>/src/**/*.db.test.ts'],
    },
    {
      displayName: 'ui',
      preset: 'jest-expo',
      testMatch: ['<rootDir>/src/**/*.ui.test.tsx'],
    },
  ],
};
