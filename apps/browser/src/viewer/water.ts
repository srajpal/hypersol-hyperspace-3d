/**
 * Water (HoloML 0.2 `water`, HyperSpace 3D milestone 21): what is seen
 * through a box of water fades into its colour with how far the view
 * travels through it, and, with `caustics`, the moving net of light that
 * the waves cast plays over what is in it. Both are added to the models'
 * own materials as they are compiled (onBeforeCompile), so a model keeps
 * everything else it has. Text (labels and panels), the background, and
 * the sky stay as they are.
 */
import {
  Color,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  RedFormat,
  RepeatWrapping,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  type Material,
  type Object3D,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import type { Vec3 } from './values';

export interface WaterLook {
  /** The middle of the water's floor. */
  position: Vec3;
  /** Width (x), height (y), and depth (z), in metres; its top is the surface. */
  size: Vec3;
  color: string;
  /** How far one can see through it, in metres: that far into the water a thing has faded fully. */
  clarity: number;
  caustics: boolean;
}

/** How long the net of light takes to change its pattern, roughly, in seconds: slow, as under calm water. */
const CAUSTICS_PACE = 1;

const VERTEX_PARS = /* glsl */ `
varying vec3 vWaterWorld;
`;

/** Where the vertex is in the world, after skinning, morphing, and instancing (transformed has the first two). */
const VERTEX = /* glsl */ `
{
  vec4 waterWorld = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    waterWorld = batchingMatrix * waterWorld;
  #endif
  #ifdef USE_INSTANCING
    waterWorld = instanceMatrix * waterWorld;
  #endif
  vWaterWorld = ( modelMatrix * waterWorld ).xyz;
}
`;

const FRAGMENT_PARS = /* glsl */ `
uniform vec3 waterMin;
uniform vec3 waterMax;
uniform vec3 waterColor;
uniform float waterClarity;
uniform float waterTime;
uniform float waterCaustics;
uniform float waterLight;
uniform sampler2D waterNetMap;
varying vec3 vWaterWorld;

// How much of the way from a to b lies inside the water's box, in metres.
float waterPath( vec3 a, vec3 b ) {
  vec3 d = b - a;
  float len = length( d );
  if ( len < 1e-4 ) return 0.0;
  vec3 dir = d / len;
  vec3 s = vec3( dir.x < 0.0 ? -1.0 : 1.0, dir.y < 0.0 ? -1.0 : 1.0, dir.z < 0.0 ? -1.0 : 1.0 );
  vec3 inv = s / max( abs( dir ), vec3( 1e-6 ) );
  vec3 t0 = ( waterMin - a ) * inv;
  vec3 t1 = ( waterMax - a ) * inv;
  vec3 tNear = min( t0, t1 );
  vec3 tFar = max( t0, t1 );
  float enter = max( max( tNear.x, tNear.y ), max( tNear.z, 0.0 ) );
  float leave = min( min( tFar.x, tFar.y ), min( tFar.z, len ) );
  return max( leave - enter, 0.0 );
}

// The net of light: two copies of the picture of it, at different sizes, drifting past each other; brightest where they cross.
float waterNet( vec2 p, float t ) {
  float a = texture2D( waterNetMap, p * 0.3 + vec2( t * 0.045, t * 0.03 ) ).r;
  float b = texture2D( waterNetMap, p * 0.46 + vec2( 0.37 - t * 0.035, 0.61 + t * 0.05 ) ).r;
  return a * 0.8 + b * 0.6 + a * b * 1.5;
}
`;

/** The net of light on lit materials, added to the light they give back (before tone mapping, as light is). */
const CAUSTICS_FRAGMENT = /* glsl */ `
if ( waterCaustics > 0.5 && all( greaterThanEqual( vWaterWorld, waterMin ) ) && all( lessThanEqual( vWaterWorld, waterMax ) ) ) {
  vec3 waterNormal = inverseTransformDirection( normal, viewMatrix );
  float waterUp = clamp( waterNormal.y * 0.7 + 0.3, 0.0, 1.0 );
  float waterDepth = waterMax.y - vWaterWorld.y;
  float waterDim = exp( - waterDepth / 7.0 );
  float waterNetHere = waterNet( vWaterWorld.xz + vec2( waterDepth * 0.07 ), waterTime );
  outgoingLight += diffuseColor.rgb * waterNetHere * waterUp * waterDim * waterLight;
}
`;

/** The haze, after the colours are in the screen's colour space, as fog is. */
const HAZE_FRAGMENT = /* glsl */ `
{
  float waterFade = clamp( waterPath( cameraPosition, vWaterWorld ) / waterClarity, 0.0, 1.0 );
  gl_FragColor.rgb = mix( gl_FragColor.rgb, waterColor, waterFade );
}
`;

/** How much of the way from a to b lies inside the box from min to max (the shader's waterPath, for the page's hooks and the tests). */
export function waterPath(a: Vec3, b: Vec3, min: Vec3, max: Vec3): number {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(d[0]!, d[1]!, d[2]!);
  if (len < 1e-4) return 0;
  let enter = 0;
  let leave = len;
  for (let k = 0; k < 3; k++) {
    const dir = d[k]! / len;
    if (Math.abs(dir) < 1e-9) {
      // Along this axis the way does not move: inside the slab or never.
      if (a[k]! < min[k]! || a[k]! > max[k]!) return 0;
      continue;
    }
    let t0 = (min[k]! - a[k]!) / dir;
    let t1 = (max[k]! - a[k]!) / dir;
    if (t0 > t1) [t0, t1] = [t1, t0];
    enter = Math.max(enter, t0);
    leave = Math.min(leave, t1);
  }
  return Math.max(0, leave - enter);
}

/**
 * The picture of the net of light, drawn once: the edges of wavy cells
 * (distance to the second-nearest point less the nearest), bright and soft,
 * tiling in both directions (the points repeat across the edges).
 */
let net: DataTexture | null = null;
function netPicture(): DataTexture {
  if (net) return net;
  const size = 256;
  const cells = 6;
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const points: [number, number][] = [];
  for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) points.push([i + 0.15 + 0.7 * random(), j + 0.15 + 0.7 * random()]);
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // A gentle, tiling warp, so the edges curve as light on the sand does.
      const u = (x / size) * cells + 0.22 * Math.sin((2 * Math.PI * 2 * y) / size);
      const v = (y / size) * cells + 0.22 * Math.sin((2 * Math.PI * 2 * x) / size);
      // Only the cells around it can hold its nearest points (each cell's point lies inside it).
      let [f1, f2] = [9, 9];
      const [ci, cj] = [Math.floor(u), Math.floor(v)];
      for (let j = cj - 1; j <= cj + 1; j++) {
        for (let i = ci - 1; i <= ci + 1; i++) {
          const [wi, wj] = [((i % cells) + cells) % cells, ((j % cells) + cells) % cells];
          const [px, py] = points[wj * cells + wi]!;
          const d = Math.hypot(px + (i - wi) - u, py + (j - wj) - v);
          if (d < f1) [f2, f1] = [f1, d];
          else if (d < f2) f2 = d;
        }
      }
      const edge = 1 - Math.min(1, Math.max(0, (f2 - f1) / 0.36));
      data[y * size + x] = Math.round(255 * edge * edge * (3 - 2 * edge) * edge);
    }
  }
  net = new DataTexture(data, size, size, RedFormat, UnsignedByteType);
  net.wrapS = net.wrapT = RepeatWrapping;
  net.magFilter = LinearFilter;
  net.minFilter = LinearMipmapLinearFilter;
  net.generateMipmaps = true;
  net.needsUpdate = true;
  return net;
}

type Hookable = MeshStandardMaterial | MeshBasicMaterial | MeshLambertMaterial | MeshPhongMaterial;

function hookable(m: Material): m is Hookable {
  return m instanceof MeshStandardMaterial || m instanceof MeshBasicMaterial || m instanceof MeshLambertMaterial || m instanceof MeshPhongMaterial;
}

export class Water {
  readonly look: WaterLook;
  readonly min: Vec3;
  readonly max: Vec3;
  /** The moving light is drawn (the page asked, and it was not left out). */
  readonly causticsShown: boolean;
  private time = 0;
  private readonly hooked = new WeakSet<Material>();
  readonly uniforms = {
    waterMin: { value: new Vector3() },
    waterMax: { value: new Vector3() },
    waterColor: { value: new Vector3() },
    waterClarity: { value: 15 },
    waterTime: { value: 0 },
    waterCaustics: { value: 0 },
    waterLight: { value: 0.35 },
    waterNetMap: { value: null as DataTexture | null },
  };

  constructor(look: WaterLook, causticsShown: boolean) {
    this.look = look;
    const [x, y, z] = look.position;
    const [w, h, d] = look.size;
    this.min = [x - w / 2, y, z - d / 2];
    this.max = [x + w / 2, y + h, z + d / 2];
    this.causticsShown = look.caustics && causticsShown;
    this.uniforms.waterMin.value.set(...this.min);
    this.uniforms.waterMax.value.set(...this.max);
    // In the screen's colour space, as the haze is mixed there (as three.js does for fog).
    const c = new Color(look.color);
    const rgb = { r: 0, g: 0, b: 0 };
    c.getRGB(rgb, SRGBColorSpace);
    this.uniforms.waterColor.value.set(rgb.r, rgb.g, rgb.b);
    this.uniforms.waterClarity.value = look.clarity;
    this.uniforms.waterCaustics.value = this.causticsShown ? 1 : 0;
    if (this.causticsShown) this.uniforms.waterNetMap.value = netPicture();
  }

  /** How bright the net of light is: it follows the page's lights from above. */
  set light(v: number) {
    this.uniforms.waterLight.value = v;
  }

  /** Moves the net of light on; false when it holds still (reduced motion) or is not drawn. */
  step(dt: number, still: boolean): boolean {
    if (!this.causticsShown || still) return false;
    this.time += (dt / 1000) * CAUSTICS_PACE;
    this.uniforms.waterTime.value = this.time;
    return true;
  }

  /** How far the net of light has moved (seconds of its own time), for the page's hooks. */
  get causticsTime(): number {
    return this.time;
  }

  /** How much a thing at `point`, seen from `eye`, has faded into the water's colour (0 to 1). */
  fadeAt(eye: Vec3, point: Vec3): number {
    return Math.min(1, waterPath(eye, point, this.min, this.max) / this.look.clarity);
  }

  /**
   * Adds the water to every model material under root that does not have
   * it yet. Text (panels are marked holomlText; labels are sprites) and
   * lines are left as they are.
   */
  hook(root: Object3D): void {
    const visit = (o: Object3D) => {
      if (o.userData['holomlText']) return;
      if (o instanceof Mesh) {
        for (const m of Array.isArray(o.material) ? (o.material as Material[]) : [o.material as Material]) {
          if (m && hookable(m) && !this.hooked.has(m)) this.hookMaterial(m);
        }
      }
      for (const c of o.children) visit(c);
    };
    visit(root);
  }

  private hookMaterial(m: Hookable): void {
    this.hooked.add(m);
    const lit = !(m instanceof MeshBasicMaterial);
    const before = m.onBeforeCompile.bind(m);
    m.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
      before(shader, renderer);
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERTEX_PARS}`)
        .replace('#include <project_vertex>', `#include <project_vertex>\n${VERTEX}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${FRAGMENT_PARS}`)
        .replace('#include <opaque_fragment>', `${lit ? CAUSTICS_FRAGMENT : ''}\n#include <opaque_fragment>`)
        .replace('#include <fog_fragment>', `#include <fog_fragment>\n${HAZE_FRAGMENT}`);
    };
    const key = m.customProgramCacheKey.bind(m);
    m.customProgramCacheKey = () => `${key()}|holoml-water${lit ? '-lit' : ''}`;
    m.needsUpdate = true;
  }
}
