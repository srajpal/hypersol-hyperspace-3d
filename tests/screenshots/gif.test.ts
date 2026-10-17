/**
 * VG6 (TODO.md, "Issue #93"): the GIF encoder and the PNG decoder of
 * gif.mjs. A PNG is made here with every filter type and decoded back to
 * its pixels; a GIF of three frames is read back by its structure (the
 * header, the palette, the loop block, each frame's rectangle and delay),
 * and its LZW stream decoded to the pixels it was given.
 */
import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePng, encodeGif, lzw, palette, readGif } from './gif.mjs';

/** A PNG of RGB pixels, each row filtered with the type given for it (0 to 4), as an encoder would. */
function png(width: number, height: number, rgb: Uint8Array, filters: number[]): Buffer {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const f = filters[y % filters.length]!;
    raw[y * (stride + 1)] = f;
    for (let i = 0; i < stride; i++) {
      const x = rgb[y * stride + i]!;
      const a = i >= 3 ? rgb[y * stride + i - 3]! : 0;
      const b = y > 0 ? rgb[(y - 1) * stride + i]! : 0;
      const c = y > 0 && i >= 3 ? rgb[(y - 1) * stride + i - 3]! : 0;
      let predicted = 0;
      if (f === 1) predicted = a;
      else if (f === 2) predicted = b;
      else if (f === 3) predicted = (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        predicted = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      raw[y * (stride + 1) + 1 + i] = (x - predicted) & 255;
    }
  }
  const chunk = (type: string, body: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'latin1');
    return Buffer.concat([head, body, Buffer.alloc(4)]); // the CRC is not read
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A frame of a solid colour, with an optional rectangle of another. */
function frame(width: number, height: number, colour: number[], box?: { x: number; y: number; w: number; h: number; colour: number[] }): { width: number; height: number; rgb: Uint8Array } {
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0; i < width * height; i++) rgb.set(colour, i * 3);
  if (box) {
    for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) rgb.set(box.colour, (y * width + x) * 3);
  }
  return { width, height, rgb };
}

/** Decodes a GIF LZW stream (sub-blocks, minimum code size 8) back to its indices. */
function unlzw(data: Buffer, count: number): number[] {
  const bytes: number[] = [];
  let at = 0;
  while (data[at] !== 0) {
    bytes.push(...data.subarray(at + 1, at + 1 + data[at]!));
    at += data[at]! + 1;
  }
  const clear = 256;
  const end = 257;
  let width = 9;
  let table: number[][] = [];
  const reset = () => {
    table = Array.from({ length: 258 }, (_, i) => [i]);
    width = 9;
  };
  reset();
  const out: number[] = [];
  let bits = 0;
  let bitCount = 0;
  let pos = 0;
  let previous: number[] | null = null;
  while (out.length < count) {
    while (bitCount < width && pos < bytes.length) {
      bits |= bytes[pos]! << bitCount;
      bitCount += 8;
      pos += 1;
    }
    const code = bits & ((1 << width) - 1);
    bits >>>= width;
    bitCount -= width;
    if (code === clear) {
      reset();
      previous = null;
      continue;
    }
    if (code === end) break;
    let entry: number[];
    if (code < table.length) entry = table[code]!;
    else if (previous) entry = [...previous, previous[0]!];
    else throw new Error('a code before any entry');
    out.push(...entry);
    if (previous && table.length < 4096) {
      table.push([...previous, entry[0]!]);
      if (table.length === 1 << width && width < 12) width += 1;
    }
    previous = entry;
  }
  return out;
}

describe('VG6: the PNG decoder', () => {
  it('reads every filter type back to the pixels', () => {
    const width = 7;
    const height = 6;
    const rgb = new Uint8Array(width * height * 3).map((_, i) => (i * 37 + (i >> 3) * 11) & 255);
    const decoded = decodePng(png(width, height, rgb, [0, 1, 2, 3, 4, 2]));
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    expect(Buffer.from(decoded.rgb).equals(Buffer.from(rgb))).toBe(true);
  });

  it('refuses what it does not read', () => {
    expect(() => decodePng(Buffer.from('GIF89a'))).toThrow(/not a PNG/);
  });
});

describe('VG6: the GIF encoder', () => {
  it('writes the header, one palette, the loop block, and each frame as the rectangle that changed', () => {
    const red = [200, 30, 30];
    const blue = [30, 30, 200];
    const frames = [frame(20, 12, red), frame(20, 12, red, { x: 5, y: 2, w: 4, h: 3, colour: blue }), frame(20, 12, red, { x: 5, y: 2, w: 4, h: 3, colour: blue })];
    const gif = encodeGif(frames, { delayMs: 100 });
    const read = readGif(gif);
    expect(read.width).toBe(20);
    expect(read.height).toBe(12);
    expect(read.colours).toBe(256);
    expect(read.loops).toBe(0); // for ever
    expect(read.frames.map((f) => [f.left, f.top, f.width, f.height, f.delayMs])).toEqual([
      [0, 0, 20, 12, 100], // the first frame, whole
      [5, 2, 4, 3, 100], // the second, only the blue rectangle
      [0, 0, 1, 1, 100], // the third, nothing changed: one pixel keeps the delay
    ]);
    expect(gif[gif.length - 1]).toBe(0x3b);
  });

  it('keeps the colours: a palette of the frames, and the LZW stream decoding to the pixels given', () => {
    const colours = palette([frame(4, 4, [10, 20, 30], { x: 0, y: 0, w: 2, h: 2, colour: [250, 240, 230] })]);
    expect(colours).toContainEqual([10, 20, 30]);
    expect(colours).toContainEqual([250, 240, 230]);
    const indices = new Uint8Array(300).map((_, i) => (i * 7) % 256);
    expect(unlzw(lzw(indices, 8), indices.length)).toEqual([...indices]);
    // A long run, which fills the code table past its first widths.
    const run = new Uint8Array(20_000).map((_, i) => (i % 5 === 0 ? 1 : 0));
    expect(unlzw(lzw(run, 8), run.length)).toEqual([...run]);
  });
});
