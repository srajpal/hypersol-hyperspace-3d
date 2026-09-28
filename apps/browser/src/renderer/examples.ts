/**
 * HoloML's example sites (milestones 16 to 18; owner, prompt 85): what the
 * start panel's "Try HoloML" and the examples dialog list. The sites are
 * published from the holoml repository with GitHub Pages; the pictures are
 * part of the browser (pnpm screenshots makes them from local copies), so
 * listing them fetches nothing: a site is asked for only when opened.
 */
import showroomPicture from './examples/showroom.jpg';
import blockworldPicture from './examples/blockworld.jpg';
import sofaStudioPicture from './examples/sofa-studio.jpg';

export interface Example {
  id: string;
  name: string;
  /** One line about it. */
  line: string;
  /** Its row under the start panel's "Try HoloML". */
  row: string;
  /** What it shows of HoloML. */
  features: string;
  picture: string;
}

const PUBLISHED = 'https://srajpal.github.io/holoml/';

/** HoloML's own repository, and its specification (owner, prompt 88). */
export const HOLOML_REPOSITORY = 'https://github.com/srajpal/holoml';
export const HOLOML_SPEC = `${HOLOML_REPOSITORY}/blob/main/SPEC.md`;

/** An example's source: its folder in the repository. */
export function exampleSource(id: string): string {
  return `${HOLOML_REPOSITORY}/tree/main/examples/${id}`;
}

export const EXAMPLES: readonly Example[] = [
  {
    id: 'showroom',
    name: 'Showroom',
    line: 'Five cars in a round hall: walk around each, and see it in three colours.',
    row: 'HoloML showroom: five cars to walk around in 3D',
    features: 'HoloML 0.1: models, materials, lights, labels, links, a turntable',
    picture: showroomPicture,
  },
  {
    id: 'blockworld',
    name: 'Blockworld',
    line: 'A small block game: break and place blocks, find five gems in the stone, and see day turn to night.',
    row: 'Blockworld: a small block game to play',
    features: 'HoloML 0.2: a script, sound, walls and gravity, a speed slider, day and night',
    picture: blockworldPicture,
  },
  {
    id: 'sofa-studio',
    name: 'Sofa studio',
    line: 'A sofa in a sunlit room: choose its fabric and its wood in place, watch the price follow, and switch to evening light.',
    row: 'Sofa studio: choose a fabric and see it in 3D',
    features: 'HoloML 0.2: choices, textured materials, shadows, a studio panorama for light, a script for the price',
    picture: sofaStudioPicture,
  },
];

let base = PUBLISHED;
const own = new Map<string, string>();

/** Test runs only: every example from a local copy (…/holoml/<id>/index.holoml). */
export function setExamplesBase(url: string): void {
  base = url.endsWith('/') ? url : `${url}/`;
}

/** Test runs only: one example's own address (the showroom's, milestone 16). */
export function setExampleUrl(id: string, url: string): void {
  own.set(id, url);
}

export function exampleUrl(id: string): string {
  return own.get(id) ?? `${base}${id}/index.holoml`;
}
