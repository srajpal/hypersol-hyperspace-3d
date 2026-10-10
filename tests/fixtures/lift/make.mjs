// Makes the pictures and models of the lifting checks (milestone 28,
// tests/e2e/m28.e2e.ts): `node tests/fixtures/lift/make.mjs`. Plain PNG
// files and glTF models written byte by byte, with Node alone.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(bytes) {
  let c = -1;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
}
/** A PNG of w by h pixels, each [r, g, b] from px(x, y). */
function png(w, h, px) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) Buffer.from(px(x, y)).copy(row, 1 + x * 3);
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}

// Four colours, one to each quarter: a lifted copy shows whether it kept the page's pixels and their way up.
writeFileSync(
  join(here, 'quadrants.png'),
  png(120, 80, (x, y) => (y < 40 ? (x < 60 ? [230, 30, 30] : [30, 200, 60]) : x < 60 ? [40, 60, 230] : [240, 220, 30])),
);
// Smaller than a picture must be to lift (48 pixels each way).
writeFileSync(join(here, 'tiny.png'), png(30, 30, () => [128, 0, 128]));
// The square model's picture: orange above, teal below.
writeFileSync(join(here, 'square.png'), png(32, 32, (_x, y) => (y < 16 ? [255, 140, 0] : [0, 128, 128])));

// A square of two triangles facing the viewer, with its picture's corners.
const floats = (a) => Buffer.from(new Float32Array(a).buffer);
const buffer = Buffer.concat([
  floats([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
  floats([0, 1, 1, 1, 1, 0, 0, 0]),
  Buffer.from(new Uint16Array([0, 1, 2, 0, 2, 3]).buffer),
  Buffer.alloc(2),
]);
const square = (image, bufferUri) => ({
  asset: { version: '2.0', generator: 'HyperSpace 3D test fixture (milestone 28)' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0, name: 'square' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], baseColorTexture: { index: 0 } } }],
  textures: [{ source: 0 }],
  images: [{ uri: image }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-1, -1, 0], max: [1, 1, 0] },
    { bufferView: 1, componentType: 5126, count: 4, type: 'VEC2' },
    { bufferView: 2, componentType: 5123, count: 6, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: 48 },
    { buffer: 0, byteOffset: 48, byteLength: 32 },
    { buffer: 0, byteOffset: 80, byteLength: 12 },
  ],
  buffers: [{ byteLength: buffer.length, uri: bufferUri }],
});
// Its buffer and its picture in files of their own, on the page's site.
writeFileSync(join(here, 'square.bin'), buffer);
writeFileSync(join(here, 'square.gltf'), `${JSON.stringify(square('square.png', 'square.bin'), null, 1)}\n`);
// Its picture on another site (check LT5): the model lifts without it, and nothing asks for it.
writeFileSync(
  join(here, 'outside.gltf'),
  `${JSON.stringify(square('http://outside.test/lift/picture.png', `data:application/octet-stream;base64,${buffer.toString('base64')}`), null, 1)}\n`,
);
