import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['**/out/**', '**/node_modules/**', 'userData/**', 'coverage/**', 'tests/fixtures/**', '.claude/**'],
  },
  ...tseslint.configs.recommended,
  // Rules that need the types (review of 2026-09-30, H8): a promise that
  // nobody awaits or catches would fail in silence, across processes.
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        // The vitest configs at the top belong to no tsconfig.
        projectService: { allowDefaultProject: ['*.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
];
