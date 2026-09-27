// Writes models/spinner.gltf for the HoloML checks (milestone 14): one box
// with a "Paint" material and an animation named "Spin" that turns it once
// around y in two seconds. Made here, so the tests use no third-party model.
//
//   node tests/fixtures/holoml/make-spinner.mjs
import { writeFileSync } from 'node:fs';

const faces = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];
const positions = [];
const normals = [];
const indices = [];
for (const { n, u, v } of faces) {
  const base = positions.length / 3;
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    for (let k = 0; k < 3; k++) positions.push(0.5 * (n[k] + su * u[k] + sv * v[k]));
    normals.push(...n);
  }
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}
// Keyframes: 0, 1, and 2 seconds; a quarter turn is not enough to be unambiguous, so 0, 180, 360 degrees.
const times = [0, 1, 2];
const quats = [0, 180, 360].flatMap((deg) => {
  const h = (deg * Math.PI) / 360;
  return [0, Math.sin(h), 0, Math.cos(h)];
});
const parts = [new Float32Array(positions), new Float32Array(normals), new Uint16Array(indices), new Float32Array(times), new Float32Array(quats)];
const bytes = parts.map((p) => Buffer.from(p.buffer));
let offset = 0;
const views = bytes.map((b, i) => {
  const view = { buffer: 0, byteOffset: offset, byteLength: b.length, ...(i < 2 ? { target: 34962 } : i === 2 ? { target: 34963 } : {}) };
  offset += b.length + ((4 - (b.length % 4)) % 4);
  return view;
});
const buffer = Buffer.concat(bytes.flatMap((b) => [b, Buffer.alloc((4 - (b.length % 4)) % 4)]));
const gltf = {
  asset: { version: '2.0', generator: 'HyperSpace 3D tests/fixtures/holoml/make-spinner.mjs' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: 'Spinner', mesh: 0, translation: [0, 0.5, 0] }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, material: 0 }] }],
  materials: [{ name: 'Paint', pbrMetallicRoughness: { baseColorFactor: [0.2, 0.6, 0.9, 1], metallicFactor: 0.2, roughnessFactor: 0.5 } }],
  animations: [{ name: 'Spin', channels: [{ sampler: 0, target: { node: 0, path: 'rotation' } }], samplers: [{ input: 3, output: 4, interpolation: 'LINEAR' }] }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 24, type: 'VEC3', min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
    { bufferView: 1, componentType: 5126, count: 24, type: 'VEC3' },
    { bufferView: 2, componentType: 5123, count: 36, type: 'SCALAR' },
    { bufferView: 3, componentType: 5126, count: 3, type: 'SCALAR', min: [0], max: [2] },
    { bufferView: 4, componentType: 5126, count: 3, type: 'VEC4' },
  ],
  bufferViews: views,
  buffers: [{ byteLength: buffer.length, uri: `data:application/octet-stream;base64,${buffer.toString('base64')}` }],
};
writeFileSync(new URL('./models/spinner.gltf', import.meta.url), JSON.stringify(gltf, null, 2) + '\n');
console.log(`wrote models/spinner.gltf (${buffer.length} bytes)`);
