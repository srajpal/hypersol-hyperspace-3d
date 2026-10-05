/**
 * The messages between the room's page and the Android app (milestone
 * 24). The page posts JSON through the app's JavaScript interface, and
 * the app calls `window.hyperspace.receive` with JSON of its own. The
 * page checks what it is given: only these shapes are acted on.
 */

export interface TabState {
  id: number;
  url: string;
  title: string;
  loading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  holoml: boolean;
  crashed: boolean;
}

export type FromApp =
  | { type: 'tabs'; tabs: TabState[]; focused: number | null; canReopen: boolean }
  | { type: 'snapshot'; id: number; dataUrl: string }
  | { type: 'tilt'; x: number; y: number }
  | { type: 'settings'; lighter: boolean };

export type ToApp =
  | { type: 'ready' }
  | { type: 'open'; url: string; newTab?: boolean }
  | { type: 'back' | 'forward' | 'reload' | 'stop' | 'new-tab' | 'reopen' }
  | { type: 'focus' | 'close'; id: number }
  | { type: 'quad'; id: number; visible: boolean; quad: number[]; width: number; height: number; dpr: number }
  | { type: 'covered'; on: boolean }
  | { type: 'lighter'; on: boolean };

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function tab(v: unknown): TabState | null {
  if (!isObject(v) || !num(v['id'])) return null;
  return {
    id: v['id'],
    url: typeof v['url'] === 'string' ? v['url'] : '',
    title: typeof v['title'] === 'string' ? v['title'] : '',
    loading: v['loading'] === true,
    canGoBack: v['canGoBack'] === true,
    canGoForward: v['canGoForward'] === true,
    holoml: v['holoml'] === true,
    crashed: v['crashed'] === true,
  };
}

/** A message from the app, checked; null for anything else. */
export function parseFromApp(v: unknown): FromApp | null {
  if (!isObject(v)) return null;
  switch (v['type']) {
    case 'tabs': {
      if (!Array.isArray(v['tabs'])) return null;
      const tabs = v['tabs'].map(tab).filter((t): t is TabState => t !== null);
      const focused = num(v['focused']) && tabs.some((t) => t.id === v['focused']) ? v['focused'] : null;
      return { type: 'tabs', tabs, focused, canReopen: v['canReopen'] === true };
    }
    case 'snapshot':
      // Only a picture the app made: a JPEG or PNG as a data address.
      if (!num(v['id']) || typeof v['dataUrl'] !== 'string' || !/^data:image\/(jpeg|png);base64,/.test(v['dataUrl'])) return null;
      return { type: 'snapshot', id: v['id'], dataUrl: v['dataUrl'] };
    case 'tilt':
      if (!num(v['x']) || !num(v['y'])) return null;
      return { type: 'tilt', x: Math.max(-1, Math.min(1, v['x'])), y: Math.max(-1, Math.min(1, v['y'])) };
    case 'settings':
      return { type: 'settings', lighter: v['lighter'] === true };
    default:
      return null;
  }
}

interface AndroidInterface {
  post(json: string): void;
}

/** Sends a message to the app; outside the app (a test, a desktop browser), nothing happens. */
export function post(message: ToApp): void {
  const app = (window as unknown as { HyperSpaceAndroid?: AndroidInterface }).HyperSpaceAndroid;
  app?.post(JSON.stringify(message));
}

/**
 * Whether the page's outline has moved enough to tell the app again:
 * more than a quarter of a CSS pixel at any corner, or a change in
 * whether it shows, its size, or the tab.
 */
export function quadChanged(last: Extract<ToApp, { type: 'quad' }> | null, next: Extract<ToApp, { type: 'quad' }>): boolean {
  if (!last) return true;
  if (last.id !== next.id || last.visible !== next.visible || last.width !== next.width || last.height !== next.height || last.dpr !== next.dpr) return true;
  return next.quad.some((v, i) => Math.abs(v - (last.quad[i] ?? Number.NaN)) > 0.25 || Number.isNaN(last.quad[i] ?? Number.NaN));
}
