import { configDefaults, defineConfig } from 'vitest/config';

/**
 * The automatic builds run the end-to-end checks in four parts, side by
 * side, so a build takes as long as its longest part (two parts from
 * milestone 21, owner, prompt 122, Q7 a; four, by the time each file took
 * on GitHub's Linux machines, from prompt 134). Parts 2 to 4 are the
 * files listed here; part 1 is everything else, so a new file joins part
 * 1 until it is given a part. Without HYPERSOL_E2E_PART, every check
 * runs, as on this computer.
 */
const files = (...milestones: string[]) => milestones.map((m) => `tests/e2e/${m}.e2e.ts`);
const PARTS: Record<string, string[]> = {
  // HoloML pages in the viewer, its limits, the showroom, and Blockworld.
  '2': files('m14', 'm15', 'm16', 'm17'),
  // The sofa studio, Harbour Loft, and the sneaker store.
  '3': files('m18', 'm19', 'm20'),
  // The ocean tunnel: the slowest file drawn in software.
  '4': files('m21'),
};
const part = process.env['HYPERSOL_E2E_PART'];
if (part !== undefined && part !== '1' && !PARTS[part]) {
  throw new Error(`HYPERSOL_E2E_PART is "${part}"; the parts are 1 to ${Object.keys(PARTS).length + 1}.`);
}

// End-to-end tests: Playwright drives the built Electron app.
// One app at a time, so windows never compete for focus or frame rate.
export default defineConfig({
  test: {
    include: (part !== undefined && PARTS[part]) || ['tests/e2e/**/*.e2e.ts'],
    exclude: [...configDefaults.exclude, ...(part === '1' ? Object.values(PARTS).flat() : [])],
    environment: 'node',
    testTimeout: 60_000,
    // Longer than the waits inside the longest hook, so a wait that fails
    // there says what it waited for before the hook's own limit cuts it
    // off: launching (up to 100 s), a first page (30 s), a HoloML site
    // drawn in software (105 s), and its models (60 s), in m18 and m19.
    hookTimeout: 300_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
