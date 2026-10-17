// A GIF encoder, and the PNG decoder that feeds it, for the ten-second GIF
// of the promotion plan's step 6 (GitHub issue #93). Playwright's ffmpeg,
// which makes the video, has no GIF encoder and no palette filters, so
// this is the script's own, as the icon script has its own ICO and ICNS
// encoders: a palette of 256 colours by median cut over every frame, each
// frame only the rectangle that changed since the one before (left in
// place, so the rest shows through), LZW, and the loop extension. No
// dithering: the pictures stay crisp and the file small.
//
// decodePng(buffer) reads what ffmpeg's png encoder writes (8 bits a
// sample, RGB or RGBA, not interlaced). Tested by gif.test.ts.
import { inflateSync } from 'node:zlib';

/** The pixels of a PNG: width, height, and RGB bytes, row by row. */
export function decodePng(buffer) {
  if (buffer.toString('latin1', 1, 4) !== 'PNG') throw new Error('not a PNG');
  let at = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  let interlace = 0;
  const data = [];
  while (at < buffer.length) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString('latin1', at + 4, at + 8);
    const body = buffer.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colour = body[9];
      interlace = body[12];
    } else if (type === 'IDAT') data.push(body);
    else if (type === 'IEND') break;
    at += 12 + length;
  }
  if (depth !== 8 || (colour !== 2 && colour !== 6) || interlace !== 0) throw new Error(`a PNG this decoder does not read: ${depth} bits, colour type ${colour}, interlace ${interlace}`);
  const channels = colour === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const rgb = new Uint8Array(width * height * 3);
  const previous = new Uint8Array(stride);
  const line = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const from = y * (stride + 1) + 1;
    for (let i = 0; i < stride; i++) {
      const x = raw[from + i];
      const a = i >= channels ? line[i - channels] : 0;
      const b = previous[i];
      const c = i >= channels ? previous[i - channels] : 0;
      let v;
      if (filter === 0) v = x;
      else if (filter === 1) v = x + a;
      else if (filter === 2) v = x + b;
      else if (filter === 3) v = x + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else throw new Error(`PNG filter ${filter}`);
      line[i] = v & 255;
    }
    for (let x = 0; x < width; x++) {
      rgb[(y * width + x) * 3] = line[x * channels];
      rgb[(y * width + x) * 3 + 1] = line[x * channels + 1];
      rgb[(y * width + x) * 3 + 2] = line[x * channels + 2];
    }
    previous.set(line);
  }
  return { width, height, rgb };
}

/** A palette of up to `size` colours by median cut over a sample of the frames' pixels. */
export function palette(frames, size = 256) {
  const samples = [];
  const total = frames.reduce((n, f) => n + f.width * f.height, 0);
  const step = Math.max(1, Math.floor(total / 120_000));
  for (const f of frames) {
    for (let i = 0; i < f.width * f.height; i += step) samples.push((f.rgb[i * 3] << 16) | (f.rgb[i * 3 + 1] << 8) | f.rgb[i * 3 + 2]);
  }
  const unique = [...new Set(samples)];
  if (unique.length <= size) return unique.map((c) => [c >> 16, (c >> 8) & 255, c & 255]);
  let boxes = [unique];
  const channel = (c, k) => (k === 0 ? c >> 16 : k === 1 ? (c >> 8) & 255 : c & 255);
  while (boxes.length < size) {
    // Split the box with the widest range, along that range, at its median.
    let widest = -1;
    let which = 0;
    let axis = 0;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let k = 0; k < 3; k++) {
        let lo = 255;
        let hi = 0;
        for (const c of box) {
          const v = channel(c, k);
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
        if (hi - lo > widest) {
          widest = hi - lo;
          which = i;
          axis = k;
        }
      }
    });
    if (widest <= 0) break;
    const box = boxes[which].sort((a, b) => channel(a, axis) - channel(b, axis));
    const half = box.length >> 1;
    boxes.splice(which, 1, box.slice(0, half), box.slice(half));
  }
  return boxes.map((box) => {
    const sum = [0, 0, 0];
    for (const c of box) {
      sum[0] += c >> 16;
      sum[1] += (c >> 8) & 255;
      sum[2] += c & 255;
    }
    return sum.map((v) => Math.round(v / box.length));
  });
}

/** Maps a frame's pixels to palette indices, with a cache by 15-bit colour. */
function quantise(frame, colours, cache) {
  const out = new Uint8Array(frame.width * frame.height);
  for (let i = 0; i < out.length; i++) {
    const r = frame.rgb[i * 3];
    const g = frame.rgb[i * 3 + 1];
    const b = frame.rgb[i * 3 + 2];
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let index = cache[key];
    if (index === 0) {
      let best = 0;
      let bestDistance = Infinity;
      for (let p = 0; p < colours.length; p++) {
        const [pr, pg, pb] = colours[p];
        const d = (pr - r) * (pr - r) + (pg - g) * (pg - g) + (pb - b) * (pb - b);
        if (d < bestDistance) {
          bestDistance = d;
          best = p;
        }
      }
      index = best + 1;
      cache[key] = index;
    }
    out[i] = index - 1;
  }
  return out;
}

/** LZW as GIF has it, from pixel indices with a minimum code size of 8, as sub-blocks of at most 255 bytes. */
export function lzw(indices, minCodeSize = 8) {
  const clear = 1 << minCodeSize;
  const end = clear + 1;
  const out = [];
  let bits = 0;
  let bitCount = 0;
  let block = [];
  const emit = (code, width) => {
    bits |= code << bitCount;
    bitCount += width;
    while (bitCount >= 8) {
      block.push(bits & 255);
      bits >>>= 8;
      bitCount -= 8;
      if (block.length === 255) {
        out.push(255, ...block);
        block = [];
      }
    }
  };
  let table = new Map();
  let next = end + 1;
  let width = minCodeSize + 1;
  emit(clear, width);
  let prefix = -1;
  for (const k of indices) {
    if (prefix < 0) {
      prefix = k;
      continue;
    }
    const key = prefix * 4096 + k;
    const found = table.get(key);
    if (found !== undefined) {
      prefix = found;
      continue;
    }
    emit(prefix, width);
    if (next < 4096) {
      table.set(key, next);
      next += 1;
      if (next - 1 === 1 << width && width < 12) width += 1;
    } else {
      emit(clear, width);
      table = new Map();
      next = end + 1;
      width = minCodeSize + 1;
    }
    prefix = k;
  }
  if (prefix >= 0) emit(prefix, width);
  emit(end, width);
  if (bitCount > 0) block.push(bits & 255);
  if (block.length > 0) out.push(block.length, ...block);
  out.push(0);
  return Buffer.from(out);
}

/**
 * A GIF of the frames (each {width, height, rgb}, all the same size), one
 * palette for all, `delayMs` between frames, looping for ever. Each frame
 * after the first carries only the rectangle that changed, left in place.
 */
export function encodeGif(frames, { delayMs = 100 } = {}) {
  if (frames.length === 0) throw new Error('no frames');
  const { width, height } = frames[0];
  const colours = palette(frames, 256);
  while (colours.length < 256) colours.push([0, 0, 0]);
  const cache = new Uint16Array(32768);
  const parts = [];
  const header = Buffer.alloc(13);
  header.write('GIF89a', 0, 'latin1');
  header.writeUInt16LE(width, 6);
  header.writeUInt16LE(height, 8);
  header[10] = 0xf7; // a global colour table of 256 colours, 8 bits a colour
  header[11] = 0;
  header[12] = 0;
  parts.push(header, Buffer.from(colours.flat()));
  // The loop extension (NETSCAPE2.0, 0 = for ever).
  parts.push(Buffer.from([0x21, 0xff, 0x0b, ...Buffer.from('NETSCAPE2.0', 'latin1'), 0x03, 0x01, 0x00, 0x00, 0x00]));
  const delay = Math.round(delayMs / 10);
  let previous = null;
  for (const frame of frames) {
    if (frame.width !== width || frame.height !== height) throw new Error('every frame must be the same size');
    const indices = quantise(frame, colours, cache);
    let left = 0;
    let top = 0;
    let right = width - 1;
    let bottom = height - 1;
    if (previous) {
      left = width;
      top = height;
      right = -1;
      bottom = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          if (indices[i] !== previous[i]) {
            if (x < left) left = x;
            if (x > right) right = x;
            if (y < top) top = y;
            if (y > bottom) bottom = y;
          }
        }
      }
      if (right < 0) {
        // Nothing changed: the frame is its top-left pixel, so the delay still counts.
        left = 0;
        top = 0;
        right = 0;
        bottom = 0;
      }
    }
    const w = right - left + 1;
    const h = bottom - top + 1;
    const rect = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) rect[y * w + x] = indices[(top + y) * width + left + x];
    // The graphic control extension: disposal 1 (leave in place), the delay, no transparency.
    const control = Buffer.from([0x21, 0xf9, 0x04, 0x04, delay & 255, delay >> 8, 0x00, 0x00]);
    const descriptor = Buffer.alloc(10);
    descriptor[0] = 0x2c;
    descriptor.writeUInt16LE(left, 1);
    descriptor.writeUInt16LE(top, 3);
    descriptor.writeUInt16LE(w, 5);
    descriptor.writeUInt16LE(h, 7);
    descriptor[9] = 0; // no local colour table
    parts.push(control, descriptor, Buffer.from([8]), lzw(rect, 8));
    previous = indices;
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}

/** What a GIF holds, by its structure: the size, the palette's size, the loop block, and each frame's rectangle and delay. Not a decoder of the pixels. */
export function readGif(buffer) {
  if (buffer.toString('latin1', 0, 6) !== 'GIF89a') throw new Error('not a GIF89a');
  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const flags = buffer[10];
  const colours = flags & 0x80 ? 1 << ((flags & 7) + 1) : 0;
  let at = 13 + colours * 3;
  let loops = null;
  const frames = [];
  let delay = 0;
  const skipBlocks = () => {
    while (buffer[at] !== 0) at += buffer[at] + 1;
    at += 1;
  };
  while (at < buffer.length) {
    const b = buffer[at];
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = buffer[at + 1];
      at += 2;
      if (label === 0xff && buffer.toString('latin1', at + 1, at + 12) === 'NETSCAPE2.0') {
        loops = buffer.readUInt16LE(at + 14);
      } else if (label === 0xf9) {
        delay = buffer.readUInt16LE(at + 2) * 10;
      }
      skipBlocks();
    } else if (b === 0x2c) {
      const frame = { left: buffer.readUInt16LE(at + 1), top: buffer.readUInt16LE(at + 3), width: buffer.readUInt16LE(at + 5), height: buffer.readUInt16LE(at + 7), delayMs: delay };
      at += 10;
      if (buffer[at - 1] & 0x80) at += 3 * (1 << ((buffer[at - 1] & 7) + 1));
      at += 1; // the minimum code size
      skipBlocks();
      frames.push(frame);
    } else throw new Error(`a block this reader does not know: ${b} at ${at}`);
  }
  return { width, height, colours, loops, frames };
}
