/**
 * HoloML's example sites (milestones 16 to 21 and 25; owner, prompt 85): what the
 * start panel's "Try HoloML" and the examples dialog list. The sites are
 * published from the holoml repository with GitHub Pages; the pictures are
 * part of the browser (pnpm screenshots makes them from local copies), so
 * listing them fetches nothing: a site is asked for only when opened.
 */
import showroomPicture from './examples/showroom.jpg';
import blockworldPicture from './examples/blockworld.jpg';
import sofaStudioPicture from './examples/sofa-studio.jpg';
import harbourLoftPicture from './examples/harbour-loft.jpg';
import sneakerStorePicture from './examples/sneaker-store.jpg';
import aquariumPicture from './examples/aquarium.jpg';
import wordsPicture from './examples/words.jpg';

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

/**
 * HoloML's own repository, and its specification (owner, prompt 88): the
 * published page since milestone 22, which HoloML's site makes from the
 * repository's SPEC.md.
 */
export const HOLOML_REPOSITORY = 'https://github.com/srajpal/holoml';
export const HOLOML_SPEC = `${PUBLISHED}spec/`;

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
    features: 'HoloML 0.3: a script, sound, walls and gravity, a speed slider, day and night',
    picture: blockworldPicture,
  },
  {
    id: 'sofa-studio',
    name: 'Sofa studio',
    line: 'A sofa in a sunlit room: choose its fabric and its wood in place, watch the price follow, and switch to evening light.',
    row: 'Sofa studio: choose a fabric and see it in 3D',
    features: 'HoloML 0.3: choices, textured materials, shadows, a studio panorama for light, a script for the price',
    picture: sofaStudioPicture,
  },
  {
    id: 'harbour-loft',
    name: 'Harbour Loft',
    line: 'A loft by the harbour to tour: open the doors, switch the lamps on, read about each room, and go up to the roof terrace.',
    row: 'Harbour Loft: tour a flat by the harbour',
    features: 'HoloML 0.3: panels, click actions, places, a sky, a floor plan, a fade between pages, and names for the furniture',
    picture: harbourLoftPicture,
  },
  {
    id: 'sneaker-store',
    name: 'Sneaker store',
    line: 'A sneaker store to walk through: a shoe in ten colourways, each loaded as you come near. Turn one over, choose its colour and size, and add it to your cart.',
    row: 'Sneaker store: walk the shelves and try a shoe',
    features: 'HoloML 0.3: loading by area, stand-ins, colour and size choices, a cart kept by a script, and compressed shoes',
    picture: sneakerStorePicture,
  },
  {
    id: 'aquarium',
    name: 'Ocean tunnel',
    line: 'An aquarium to walk through: sharks, a sea turtle, tuna, and schools of fish swim over and around a glass tunnel. Feed them, and read about each.',
    row: 'Ocean tunnel: walk under the fish',
    features: 'HoloML 0.3: water, light from the waves, sounds from a place, and 30 fish swum by a script, lighter far away',
    picture: aquariumPicture,
  },
  {
    id: 'words',
    name: 'Words in a room',
    line: 'Welcome signs in English, Arabic, and Hebrew: each in its own language and direction, and read in its own voice.',
    row: 'Words in a room: signs in three languages',
    features: 'HoloML 0.3: lang and dir, right-to-left text, and names for screen readers',
    picture: wordsPicture,
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
