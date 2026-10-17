/** The types of gif.mjs, for its test and the type check (the module itself is plain JavaScript). */
export interface Frame {
  width: number;
  height: number;
  rgb: Uint8Array;
}
export interface GifFrame {
  left: number;
  top: number;
  width: number;
  height: number;
  delayMs: number;
}
export function decodePng(buffer: Buffer): Frame;
export function palette(frames: Frame[], size?: number): number[][];
export function lzw(indices: Uint8Array, minCodeSize?: number): Buffer;
export function encodeGif(frames: Frame[], options?: { delayMs?: number }): Buffer;
export function readGif(buffer: Buffer): { width: number; height: number; colours: number; loops: number | null; frames: GifFrame[] };
