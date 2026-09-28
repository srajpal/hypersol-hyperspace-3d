/**
 * Pictures a page names itself (HoloML 0.2, milestone 18): a material's
 * colour, normal, and roughness pictures, and the panorama of the
 * surroundings. Each comes from the page's own site within its limits
 * (budget.ts), each address once, and its size is read from its header
 * before it is decoded, so a huge picture is left out, not decoded.
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
import { LeftOut, LIMITS, pictureSize, type Budget } from './budget';

/** A colour picture (in sRGB), or data such as bumps and roughness (as they are). */
export type PictureUse = 'color' | 'data';

function tooLarge(width: number, height: number): LeftOut | null {
  return width > LIMITS.pictureSide || height > LIMITS.pictureSide
    ? new LeftOut(`a picture of ${width} by ${height} pixels is larger than ${LIMITS.pictureSide} by ${LIMITS.pictureSide}`)
    : null;
}

export class Pictures {
  private readonly bitmaps = new Map<string, Promise<ImageBitmap>>();
  private readonly textures = new Map<string, Promise<Texture>>();

  constructor(
    private readonly budget: Budget,
    private readonly origin: string,
    /** How sharp a picture stays when seen at a slant (fabric on a sofa's side). */
    private readonly anisotropy = 1,
  ) {}

  private bitmap(url: URL): Promise<ImageBitmap> {
    let picture = this.bitmaps.get(url.href);
    if (!picture) {
      picture = this.budget.file(url, this.origin).then(({ data, bytes }) =>
        this.keepingBytes(bytes, () => {
          const size = pictureSize(new Uint8Array(data));
          if (!size) throw new Error('not a PNG, JPEG, or WebP picture');
          const over = tooLarge(size.width, size.height);
          if (over) throw over;
          return createImageBitmap(new Blob([data]));
        }),
      );
      this.bitmaps.set(url.href, picture);
    }
    return picture;
  }

  /** Makes something of a picture's bytes; if that fails, the picture is not shown and its bytes stop counting (as a model's). */
  private async keepingBytes<T>(bytes: number, make: () => T | Promise<T>): Promise<T> {
    try {
      return await make();
    } catch (e) {
      this.budget.releaseBytes(bytes);
      throw e;
    }
  }

  /**
   * A material's picture, tiled `repeat` times. Uses of one picture share
   * it on the graphics card (each use is a copy of one texture, with its
   * own tiling). Pictures follow glTF's convention, as the models' own.
   */
  async texture(url: URL, use: PictureUse, repeat: readonly [number, number]): Promise<Texture> {
    const key = `${use} ${url.href}`;
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
    const copy = (await base).clone();
    copy.repeat.set(repeat[0], repeat[1]);
    copy.needsUpdate = true;
    return copy;
  }

  /** The surroundings: an HDR panorama, or a PNG or JPEG one, to light the scene. */
  async environment(url: URL): Promise<Texture> {
    if (/\.hdr$/i.test(url.pathname)) {
      const { data, bytes } = await this.budget.file(url, this.origin);
      const hdr = await this.keepingBytes(bytes, () => {
        const parsed = new HDRLoader().parse(data);
        if (!parsed.width || !parsed.height || !parsed.data) throw new Error('not an HDR panorama');
        const over = tooLarge(parsed.width, parsed.height);
        if (over) throw over;
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
    const t = new Texture(await this.bitmap(url));
    t.colorSpace = SRGBColorSpace;
    t.mapping = EquirectangularReflectionMapping;
    t.needsUpdate = true;
    return t;
  }
}
