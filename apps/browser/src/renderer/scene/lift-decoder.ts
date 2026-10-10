import { VIEWER_SCHEME } from '../../shared/holoml-page';
import { parseLiftedShape, type LiftedShape } from '../../shared/lifted-shape';

/**
 * Decodes a lifted model (milestone 28, Q3 a) in a frame of the HoloML
 * viewer's address (viewer/lift-host.ts): sandboxed, scripts only, of no
 * origin, unseen, and with a content policy that lets it reach no network.
 * One frame for each model, removed once it has answered; the shell checks
 * the answer before anything of it is drawn (shared/lifted-shape.ts).
 */

const HOST = `${VIEWER_SCHEME}://app/lift-host.html`;
/** How long the frame has to load, decode, and answer. */
const DECODE_MS = 30_000;

export interface ModelFiles {
  url: string;
  main: Uint8Array;
  resources: { uri: string; bytes: Uint8Array }[];
}

/** An ArrayBuffer of its own holding these bytes, to move to the frame. */
function own(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.byteLength === bytes.byteLength && bytes.byteOffset === 0 && bytes.buffer instanceof ArrayBuffer ? bytes.buffer : bytes.slice().buffer;
}

/** Decodes the files: the model's shapes and pictures, or an Error saying why not. */
export function decodeModel(files: ModelFiles): Promise<LiftedShape> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.hidden = true;
    frame.tabIndex = -1;
    frame.setAttribute('aria-hidden', 'true');
    frame.title = 'Model decoder';
    frame.dataset['testid'] = 'lift-decoder';
    let done = false;
    const finish = (error: Error | null, shape?: LiftedShape) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      frame.remove();
      if (error) reject(error);
      else resolve(shape!);
    };
    const timer = window.setTimeout(() => finish(new Error(`it took longer than ${DECODE_MS / 1000} seconds to decode`)), DECODE_MS);
    frame.addEventListener(
      'load',
      () => {
        const win = frame.contentWindow;
        if (!win) {
          finish(new Error('it could not be decoded'));
          return;
        }
        const channel = new MessageChannel();
        channel.port1.onmessage = (e: MessageEvent<{ ok?: unknown; shape?: unknown; reason?: unknown }>) => {
          channel.port1.close();
          if (e.data?.ok === true) {
            const shape = parseLiftedShape(e.data.shape);
            if (shape) finish(null, shape);
            else finish(new Error('what it decoded to could not be used'));
          } else {
            finish(new Error(typeof e.data?.reason === 'string' ? e.data.reason.slice(0, 200) : 'it could not be decoded'));
          }
        };
        const main = own(files.main);
        const resources = files.resources.map((r) => ({ uri: r.uri, bytes: own(r.bytes) }));
        // Sandboxed, the frame has no origin to name: the message goes to whatever it holds, which can only be
        // the viewer's page (this window's content policy frames nothing else) or nothing that runs scripts.
        win.postMessage({ hypersolLift: true, url: files.url, main, resources }, '*', [channel.port2, main, ...resources.map((r) => r.bytes)]);
      },
      { once: true },
    );
    frame.src = HOST;
    document.body.append(frame);
  });
}
