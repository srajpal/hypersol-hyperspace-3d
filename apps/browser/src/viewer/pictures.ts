/**
 * Pictures a page names itself (HoloML 0.2, milestone 18): a material's
 * colour, normal, and roughness pictures, and the panorama of the
 * surroundings; since milestone 19, the sky and a floor plan too. Each
 * comes from the page's own site within its limits (budget.ts), each
 * address once, and its size is read from its header before it is
 * decoded, so a huge picture is left out, not decoded.
 *
 * Milestone 20 (loading by area): a material's picture that no model
 * uses any more is let go, and its bytes stop counting.
 *
 * Review 134 (V6, V10): each picture's pixels count towards the page's
 * pixels of pictures, from its header, before it is decoded; an HDR
 * panorama's size is read from its header before it is unpacked; and a
 * picture that is not shown after all gives back everything it held.
 */
import {
  DataTexture,
  EquirectangularReflectionMapping,
  LinearFilter,
  LinearSRGBColorSpace,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
} from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { hdrSize, LeftOut, LIMITS, pictureSize, Unreadable, type Budget, type Claim } from './budget';

/** A colour picture (in sRGB), or data such as bumps and roughness (as they are). */
export type PictureUse = 'color' | 'data';

/** A picture's file as it arrived, with what it holds of the page's totals (its bytes and its pixels). */
interface PictureFile {
  data: ArrayBuffer;
  bytes: number;
  claim: Claim;
}

function tooLarge(width: number, height: number): LeftOut | null {
  return width > LIMITS.pictureSide || height > LIMITS.pictureSide
    ? new LeftOut(`a picture of ${width} by ${height} pixels is larger than ${LIMITS.pictureSide} by ${LIMITS.pictureSide}`)
    : null;
}

export class Pictures {
  private readonly bitmaps = new Map<string, Promise<ImageBitmap>>();
  private readonly files = new Map<string, Promise<PictureFile>>();
  private readonly textures = new Map<string, Promise<Texture>>();
  /** Panoramas: the surroundings and the sky may be one file, loaded (and counted) once. */
  private readonly panoramas = new Map<string, Promise<Texture>>();
  /** How many materials use each material picture (by address), so one no model uses any more can be let go. */
  private readonly uses = new Map<string, number>();
  /** Pictures the page shows itself (the surroundings, the sky, a floor plan): kept while the page lives. */
  private readonly kept = new Set<string>();

  constructor(
    private readonly budget: Budget,
    private readonly origin: string,
    /** How sharp a picture stays when seen at a slant (fabric on a sofa's side). */
    private readonly anisotropy = 1,
  ) {}

  /**
   * A picture, decoded. WebGL does not flip a decoded bitmap, so one to
   * be seen the right way up (a panorama, in the convention three.js
   * expects for it) is decoded upside down; materials' pictures keep
   * glTF's convention, as they are.
   */
  private bitmap(url: URL, flip = false): Promise<ImageBitmap> {
    const key = `${flip ? 'flipped ' : ''}${url.href}`;
    let picture = this.bitmaps.get(key);
    if (!picture) {
      picture = this.checked(url).then(({ data, claim }) => this.keeping(claim, () => createImageBitmap(new Blob([data]), flip ? { imageOrientation: 'flipY' } : {})));
      this.bitmaps.set(key, picture);
    }
    return picture;
  }

  /**
   * A picture's bytes: fetched and counted once however it is used, with
   * its size read from its header and checked, and its pixels counted
   * towards the page's, before anything is decoded.
   */
  private checked(url: URL): Promise<PictureFile> {
    let file = this.files.get(url.href);
    if (!file) {
      file = this.budget.file(url, this.origin).then((got) =>
        this.keeping(got.claim, () => {
          const size = pictureSize(new Uint8Array(got.data));
          if (!size) throw new Unreadable('not a PNG, JPEG, or WebP picture');
          const over = tooLarge(size.width, size.height);
          if (over) throw over;
          got.claim.setPixels(size.width * size.height);
          return got;
        }),
      );
      this.files.set(url.href, file);
    }
    return file;
  }

  /**
   * Makes something of a picture's bytes; if that fails, the picture is
   * not shown and what it held (its bytes, its pixels) stops counting, as
   * a model's (once, however many ways it was used).
   */
  private async keeping<T>(claim: Claim, make: () => T | Promise<T>): Promise<T> {
    try {
      return await make();
    } catch (e) {
      claim.release();
      throw e;
    }
  }

  /**
   * A picture the page shows itself could not be shown after all (its
   * bytes are not a picture a browser can draw): what it held stops
   * counting. It stays known as failed, and is not fetched again.
   */
  discard(url: URL): void {
    void this.files.get(url.href)?.then(({ claim }) => claim.release(), () => undefined);
  }

  /**
   * A material's picture, tiled `repeat` times. Uses of one picture share
   * it on the graphics card (each use is a copy of one texture, with its
   * own tiling). Pictures follow glTF's convention, as the models' own.
   */
  async texture(url: URL, use: PictureUse, repeat: readonly [number, number]): Promise<Texture> {
    const key = `${use} ${url.href}`;
    this.uses.set(url.href, (this.uses.get(url.href) ?? 0) + 1);
    let base = this.textures.get(key);
    if (!base) {
      base = this.bitmap(url).then((image) => {
        const t = new Texture(image);
        t.flipY = false;
        t.colorSpace = use === 'color' ? SRGBColorSpace : NoColorSpace;
        t.wrapS = RepeatWrapping;
        t.wrapT = RepeatWrapping;
        t.anisotropy = this.anisotropy;
        // Its address, for the tests and the inspector (copies keep it).
        t.userData['src'] = url.href;
        t.needsUpdate = true;
        return t;
      });
      this.textures.set(key, base);
    }
    let copy: Texture;
    try {
      copy = (await base).clone();
    } catch (e) {
      // Not shown, so never released: the use ends here (the failure stays known, and is not fetched again).
      this.uses.set(url.href, (this.uses.get(url.href) ?? 1) - 1);
      throw e;
    }
    copy.repeat.set(repeat[0], repeat[1]);
    copy.needsUpdate = true;
    return copy;
  }

  /**
   * A material's picture that a model no longer uses: its copy is
   * released at once. With `drop` (a model let go, loading by area,
   * milestone 20), the picture itself (its bytes, its decoded image, its
   * textures) is let go too once no material uses it and the page does
   * not show it itself; without (a model removed), it stays for the next.
   */
  release(t: Texture, drop: boolean): void {
    const href = t.userData['src'] as string | undefined;
    t.dispose();
    if (!href) return;
    const left = (this.uses.get(href) ?? 1) - 1;
    if (left > 0) {
      this.uses.set(href, left);
      return;
    }
    this.uses.delete(href);
    if (!drop || this.kept.has(href)) return;
    for (const use of ['color', 'data'] as const) {
      const base = this.textures.get(`${use} ${href}`);
      this.textures.delete(`${use} ${href}`);
      void base?.then((x) => x.dispose(), () => undefined);
    }
    const bitmap = this.bitmaps.get(href);
    this.bitmaps.delete(href);
    void bitmap?.then((b) => b.close(), () => undefined);
    const file = this.files.get(href);
    this.files.delete(href);
    // A picture that failed after it arrived gave back what it held then.
    void file?.then(({ claim }) => claim.release(), () => undefined);
  }

  /** A panorama, an HDR, PNG, or JPEG picture: the surroundings, to light the scene, or the sky, to draw behind it. */
  environment(url: URL): Promise<Texture> {
    this.kept.add(url.href);
    let panorama = this.panoramas.get(url.href);
    if (!panorama) {
      panorama = this.panorama(url);
      this.panoramas.set(url.href, panorama);
    }
    return panorama;
  }

  /**
   * A picture shown by the page itself (a floor plan, milestone 19): an
   * address of its bytes, once its size has been read and checked.
   */
  async address(url: URL): Promise<string> {
    this.kept.add(url.href);
    const { data } = await this.checked(url);
    return URL.createObjectURL(new Blob([data]));
  }

  private async panorama(url: URL): Promise<Texture> {
    if (/\.hdr$/i.test(url.pathname)) {
      const { data, claim } = await this.budget.file(url, this.origin);
      const hdr = await this.keeping(claim, () => {
        // Its size from the text at its start, before it is unpacked: a huge one never is.
        const size = hdrSize(new Uint8Array(data));
        const large = size ? tooLarge(size.width, size.height) : null;
        if (large) throw large;
        if (size) claim.setPixels(size.width * size.height);
        const parsed = new HDRLoader().parse(data);
        if (!parsed.width || !parsed.height || !parsed.data) throw new Unreadable('not an HDR panorama');
        const over = tooLarge(parsed.width, parsed.height);
        if (over) throw over;
        claim.setPixels(parsed.width * parsed.height);
        return { data: parsed.data, width: parsed.width, height: parsed.height, type: parsed.type };
      });
      const t = new DataTexture(hdr.data, hdr.width, hdr.height, RGBAFormat, hdr.type);
      t.colorSpace = LinearSRGBColorSpace;
      t.minFilter = LinearFilter;
      t.magFilter = LinearFilter;
      t.generateMipmaps = false;
      t.flipY = true;
      t.mapping = EquirectangularReflectionMapping;
      t.needsUpdate = true;
      return t;
    }
    const t = new Texture(await this.bitmap(url, true));
    t.flipY = false;
    t.colorSpace = SRGBColorSpace;
    t.mapping = EquirectangularReflectionMapping;
    t.needsUpdate = true;
    return t;
  }
}
