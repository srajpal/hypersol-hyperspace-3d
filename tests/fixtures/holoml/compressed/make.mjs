// Makes the compressed test models for milestone 25's check HL4 (owner,
// prompt 168: KTX2 test models from Khronos's glTF Sample Assets, fetched
// once): from Khronos's samples at one commit, each download checked
// against its recorded SHA-256 sum, and glTF Transform from the holoml
// repository beside this one for the meshopt copy.
//
//   node tests/fixtures/holoml/compressed/make.mjs
//
// It writes, beside itself:
//   draco-box.gltf, draco-box.bin    Khronos's Box, Draco-compressed (KHR_draco_mesh_compression)
//   meshopt-box.glb                  Khronos's Box, compressed with glTF Transform (EXT_meshopt_compression)
//   ktx2-box.gltf, .bin, .ktx2       Khronos's BoxTextured, its picture a KTX2 one (KHR_texture_basisu)
//                                    from Khronos's Chronograph Watch
//   broken-draco.gltf, .bin          the Draco box with its compressed data spoiled
// The files are committed; this is run again only to make them again.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const holoml = join(here, '..', '..', '..', '..', '..', 'holoml');
const COMMIT = 'edc7c9e67c639d230715049ee31f9a96a6babbbe';
const BASE = `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/${COMMIT}/Models/`;
/** Each file's SHA-256, recorded the first time it was fetched; a file that changes is refused. */
const SUMS = JSON.parse(readFileSync(join(here, 'sums.json'), 'utf8'));

async function fetchChecked(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const sum = createHash('sha256').update(bytes).digest('hex');
  if (SUMS[path] && SUMS[path] !== sum) throw new Error(`${path}: its SHA-256 is ${sum}, not the recorded ${SUMS[path]}`);
  SUMS[path] = sum;
  return bytes;
}

// Draco: the sample as it is, renamed.
const dracoGltf = JSON.parse((await fetchChecked('Box/glTF-Draco/Box.gltf')).toString('utf8'));
const dracoBin = await fetchChecked('Box/glTF-Draco/Box.bin');
dracoGltf.buffers[0].uri = 'draco-box.bin';
writeFileSync(join(here, 'draco-box.gltf'), JSON.stringify(dracoGltf, null, 2));
writeFileSync(join(here, 'draco-box.bin'), dracoBin);

// A broken one: the same, with every byte of the compressed data turned over.
const broken = structuredClone(dracoGltf);
broken.buffers[0].uri = 'broken-draco.bin';
writeFileSync(join(here, 'broken-draco.gltf'), JSON.stringify(broken, null, 2));
writeFileSync(join(here, 'broken-draco.bin'), Buffer.from(dracoBin.map((b) => b ^ 0xff)));

// meshopt: glTF Transform's copy of the plain Box.
const work = mkdtempSync(join(tmpdir(), 'hl4-'));
try {
  writeFileSync(join(work, 'box.glb'), await fetchChecked('Box/glTF-Binary/Box.glb'));
  execFileSync('pnpm', ['--dir', holoml, 'exec', 'gltf-transform', 'meshopt', join(work, 'box.glb'), join(here, 'meshopt-box.glb')], { stdio: 'inherit', shell: process.platform === 'win32' });
} finally {
  rmSync(work, { recursive: true, force: true });
}

// KTX2: BoxTextured, its PNG swapped for a KTX2 picture (Basis Universal) through KHR_texture_basisu.
const textured = JSON.parse((await fetchChecked('BoxTextured/glTF/BoxTextured.gltf')).toString('utf8'));
writeFileSync(join(here, 'ktx2-box.bin'), await fetchChecked('BoxTextured/glTF/BoxTextured0.bin'));
writeFileSync(join(here, 'ktx2-box.ktx2'), await fetchChecked('ChronographWatch/glTF-KTX-BasisU/carbonfiber_normal.ktx2'));
textured.buffers[0].uri = 'ktx2-box.bin';
textured.images = [{ uri: 'ktx2-box.ktx2', mimeType: 'image/ktx2' }];
textured.textures = textured.textures.map((t) => ({ ...(t.sampler === undefined ? {} : { sampler: t.sampler }), extensions: { KHR_texture_basisu: { source: 0 } } }));
textured.extensionsUsed = [...new Set([...(textured.extensionsUsed ?? []), 'KHR_texture_basisu'])];
textured.extensionsRequired = [...new Set([...(textured.extensionsRequired ?? []), 'KHR_texture_basisu'])];
writeFileSync(join(here, 'ktx2-box.gltf'), JSON.stringify(textured, null, 2));

writeFileSync(join(here, 'sums.json'), `${JSON.stringify(SUMS, null, 2)}\n`);
console.log('made the compressed test models');
