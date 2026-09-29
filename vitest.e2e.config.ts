import { configDefaults, defineConfig } from 'vitest/config';

/**
 * The automatic builds run the end-to-end checks in two parts, side by
 * side, to stay within their time (owner, prompt 122, Q7 a): part 2 is
 * HoloML's example sites from milestone 18 on, part 1 everything else
 * (about half the time each on GitHub's Linux machines). Without
 * HYPERSOL_E2E_PART, every check runs, as on this computer.
 */
const SITES = ['m18', 'm19', 'm20', 'm21'].map((m) => `tests/e2e/${m}.e2e.ts`);
const part = process.env['HYPERSOL_E2E_PART'];

// End-to-end tests: Playwright drives the built Electron app.
// One app at a time, so windows never compete for focus or frame rate.
export default defineConfig({
  test: {
    include: part === '2' ? SITES : ['tests/e2e/**/*.e2e.ts'],
    exclude: [...configDefaults.exclude, ...(part === '1' ? SITES : [])],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 90_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
