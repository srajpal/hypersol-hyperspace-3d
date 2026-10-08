/**
 * The KTX2 transcoder's host (milestone 25; owner, prompt 170): a page of
 * the viewer's own address, framed (unseen) by a HoloML page, where
 * three.js's Basis Universal transcoder runs in workers. The transcoder
 * evaluates code from text, which HoloML pages' content policy does not
 * allow; this page has a policy of its own that does (main/holoml.ts,
 * KTX2_HOST_CSP), so the pages stay without it.
 *
 * The HoloML page's viewer sends a message port once; over it, each of
 * its stand-in workers (decoders.ts) posts what three.js's KTX2Loader
 * would post to a worker, and gets back what the worker answers. This
 * page does nothing else, and reads nothing from the HoloML page.
 */
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

type Request = { worker: number; op: 'post'; msg: unknown } | { worker: number; op: 'terminate' };

/** The worker's source (the transcoder and three.js's worker code), made here, where it may run. */
const loader = new KTX2Loader();
const source = loader.init().then(() => (loader as unknown as { workerSourceURL: string }).workerSourceURL);

/** The array buffers in a message, to move rather than copy (the pictures' bytes). */
function buffers(value: unknown, out: Set<ArrayBuffer> = new Set(), depth = 0): ArrayBuffer[] {
  if (depth > 6 || value === null || typeof value !== 'object') return [...out];
  if (value instanceof ArrayBuffer) out.add(value);
  else if (ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer) out.add(value.buffer);
  else for (const v of Object.values(value)) buffers(v, out, depth + 1);
  return [...out];
}

window.addEventListener('message', (e: MessageEvent) => {
  const port = e.ports[0];
  if (e.source !== window.parent || (e.data as { hypersolKtx2?: unknown } | null)?.hypersolKtx2 !== true || !port) return;
  // One promise each, so that a worker's messages reach it in the order they came, and it is made once.
  const workers = new Map<number, Promise<Worker>>();
  port.onmessage = async (m: MessageEvent<Request>) => {
    const r = m.data;
    let made = workers.get(r.worker);
    if (r.op === 'terminate') {
      workers.delete(r.worker);
      (await made)?.terminate();
      return;
    }
    if (!made) {
      const id = r.worker;
      made = source.then((url) => {
        const w = new Worker(url);
        w.addEventListener('message', (answer: MessageEvent) => port.postMessage({ worker: id, data: answer.data }, buffers(answer.data)));
        return w;
      });
      workers.set(id, made);
    }
    (await made).postMessage(r.msg, buffers(r.msg));
  };
  port.postMessage({ ready: true });
});
