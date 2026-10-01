// Makes the two small models of the review-134 viewer checks: a one-metre box with one material, its mesh
// kept in the file itself. Run from the working copy's root.
import { writeFileSync } from 'node:fs';

const faces = [
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
];
const positions = [];
const normals = [];
const uvs = [];
const indices = [];
for (const [f, { n, u, v }] of faces.entries()) {
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    positions.push(...[0, 1, 2].map((i) => 0.5 * (n[i] + a * u[i] + b * v[i])));
    normals.push(...n);
    uvs.push((a + 1) / 2, (1 - b) / 2);
  }
  indices.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3);
}
const parts = [new Float32Array(positions), new Float32Array(normals), new Float32Array(uvs), new Uint16Array(indices)];
const bytes = Buffer.concat(parts.map((p) => Buffer.from(p.buffer)));
let offset = 0;
const bufferViews = parts.map((p, i) => {
  const view = { buffer: 0, byteOffset: offset, byteLength: p.byteLength, target: i === 3 ? 34963 : 34962 };
  offset += p.byteLength;
  return view;
});

function model(name, material, extensions) {
  return JSON.stringify(
    {
      asset: { version: '2.0', generator: 'HyperSpace 3D tests: the review-134 viewer checks' },
      ...extensions,
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name, mesh: 0 }],
      meshes: [{ name, primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
      materials: [material],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
        { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
        { bufferView: 2, componentType: 5126, count: 24, type: 'VEC2' },
        { bufferView: 3, componentType: 5123, count: 36, type: 'SCALAR' },
      ],
      bufferViews,
      buffers: [{ byteLength: bytes.length, uri: `data:application/octet-stream;base64,${bytes.toString('base64')}` }],
    },
    null,
    1,
  );
}

// A box whose one material, "Sign", takes no light (glTF's KHR_materials_unlit): white, so a colour shows as itself.
writeFileSync(
  'tests/fixtures/holoml/review-134-unlit.gltf',
  `${model('sign', { name: 'Sign', pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1] }, extensions: { KHR_materials_unlit: {} } }, { extensionsUsed: ['KHR_materials_unlit'] })}\n`,
);
// The same box, in a file that says it cannot be shown without an extension no renderer has.
writeFileSync(
  'tests/fixtures/holoml/review-134-needs.gltf',
  `${model('needs', { name: 'Box', pbrMetallicRoughness: { baseColorFactor: [0.8, 0.8, 0.8, 1], metallicFactor: 0, roughnessFactor: 0.8 } }, { extensionsUsed: ['EXT_made_up'], extensionsRequired: ['EXT_made_up'] })}\n`,
);
