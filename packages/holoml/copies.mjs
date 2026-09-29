// What sync.mjs copies from the holoml repository, and how: the import
// paths change to this package's files, and each file says where it came
// from. Shared with the test that checks the copies (src/copy.test.ts).
import { createHash } from 'node:crypto';

export const COPIES = [
  { from: 'packages/parser/src/index.ts', to: 'src/parser.ts' },
  { from: 'packages/schema/src/rules.ts', to: 'src/rules.ts' },
  { from: 'packages/schema/src/index.ts', to: 'src/schema.ts' },
];

/**
 * HoloML's example sites (milestones 16 to 20), copied byte for byte into
 * the browser's test fixtures, so the end-to-end checks serve them from
 * 127.0.0.1. The scripts that make them stay in the holoml repository.
 */
export const EXAMPLES = { from: 'examples/', to: '../../tests/fixtures/holoml/', names: ['showroom', 'blockworld', 'sofa-studio', 'harbour-loft', 'sneaker-store', 'aquarium'], skip: /^tools\// };

export function transform(text, from, tag) {
  const body = text
    .replace(/\r\n/g, '\n')
    .replace(/from '@holoml\/parser'/g, "from './parser'")
    .replace(/from '\.\/rules\.ts'/g, "from './rules'");
  return (
    `// Copied from the holoml repository (https://github.com/srajpal/holoml),\n` +
    `// ${from} at ${tag}. Apache License 2.0, The HoloML Authors.\n` +
    `// Do not edit here: change HoloML there and run pnpm holoml:sync.\n\n` +
    body
  );
}

/** Accepts text or bytes. */
export function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}
