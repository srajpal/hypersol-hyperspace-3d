/**
 * Compressed glTF files (milestone 25, Q4 a): geometry compressed with
 * Draco (KHR_draco_mesh_compression) or meshopt (EXT_meshopt_compression,
 * KHR_meshopt_compression), and pictures compressed as KTX2 with Basis
 * Universal (KHR_texture_basisu). The decoders are three.js's own (Draco
 * and Basis Universal, Apache 2.0; meshopt, MIT): its loaders name their
 * files beside themselves, and the viewer's build carries them, so they
 * are served from the viewer's own address: nothing is fetched from
 * anywhere else. Draco and KTX2 decode in workers; meshopt in the page.
 * What they decode counts against the page's limits as any model does
 * (scene.ts, decode()).
 */
import { LoadingManager, type WebGLRenderer } from 'three';
import { DRACO_GLTF_CONFIG, DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { hiddenFrame } from './guard';

/** The glTF extensions these decoders add to what three.js's loader reads by itself. */
export const COMPRESSION_EXTENSIONS: readonly string[] = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_meshopt_compression', 'KHR_texture_basisu'];

/**
 * Where the viewer's own files are: the decoders' files sit beside its
 * scripts in the build. In a development run the dev server serves them
 * from its own paths, all under the viewer's address.
 */
const here = new URL(import.meta.url);
const VIEWER_FILES = import.meta.env.DEV ? `${here.protocol}//${here.host}/` : new URL('.', import.meta.url).href;
/**
 * The KTX2 transcoder's host page, at the viewer's address's root. Built,
 * the viewer's scripts are in assets/; in a development run this file's
 * own address is its place in the sources, and a path from it led nowhere
 * (owner, prompt 194).
 */
const KTX2_HOST = import.meta.env.DEV ? `${here.protocol}//${here.host}/ktx2-host.html` : new URL('../ktx2-host.html', import.meta.url).href;

export interface Decoders {
  draco: DRACOLoader;
  ktx2: KTX2Loader;
  meshopt: typeof MeshoptDecoder;
}

/**
 * The decoders for one viewer, made when the first model needs them. The
 * decoders' own files come from the viewer's address. The KTX2 loader also
 * loads a model's pictures through the same manager: those come from the
 * files the page's limits have counted (`counted`), or from the model
 * itself (blob: and data:); anything else goes nowhere.
 */
export function makeDecoders(renderer: WebGLRenderer, counted: (url: string) => string | null): Decoders {
  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    const found = counted(url);
    if (found) return found;
    return url.startsWith(VIEWER_FILES) ? url : 'blob:uncounted';
  });
  // The decoder made for glTF files: smaller than the general one, which the build carries but the viewer never loads.
  const draco = new DRACOLoader(manager).setDecoderPath(DRACO_GLTF_CONFIG).setWorkerLimit(2);
  const ktx2 = new KTX2Loader(manager).setWorkerLimit(2).detectSupport(renderer);
  // On the desktop the viewer comes from its own address, and a HoloML page's content policy does not let the
  // Basis transcoder evaluate code: its workers run in the transcoder's host instead (ktx2-host.ts; owner, prompt
  // 170). Where the viewer is served from the page's own site (Android), three.js's own workers do.
  if (here.origin !== location.origin) {
    const remote = remoteWorkers(KTX2_HOST);
    const init = ktx2.init.bind(ktx2);
    const loader = ktx2 as unknown as { workerConfig: unknown; transcoderBinary: ArrayBuffer };
    ktx2.init = () =>
      init().then(() =>
        ktx2.workerPool.setWorkerCreator(() => {
          // As three.js's own creator does: each new worker is first given the settings and the transcoder.
          const worker = remote();
          const transcoderBinary = loader.transcoderBinary.slice(0);
          worker.postMessage({ type: 'init', config: loader.workerConfig, transcoderBinary }, [transcoderBinary]);
          return worker;
        }),
      );
  }
  return { draco, ktx2, meshopt: MeshoptDecoder };
}

/**
 * Stand-ins for the KTX2 transcoder's workers: what three.js's KTX2Loader
 * posts to one goes, over a message port, to the transcoder's host (an
 * unseen, sandboxed frame of the viewer's own address, guard.ts), which posts it to a real
 * worker there and sends back its answers. The frame is made when the
 * first KTX2 picture needs it.
 */
function remoteWorkers(hostUrl: string): () => Worker {
  let host: Promise<MessagePort> | null = null;
  const listeners = new Map<number, Set<(e: { data: unknown }) => void>>();
  const connect = (): Promise<MessagePort> =>
    (host ??= new Promise((resolve) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (e: MessageEvent<{ ready?: boolean; worker?: number; data?: unknown }>) => {
        if (e.data.ready) resolve(channel.port1);
        else if (e.data.worker !== undefined) for (const fn of listeners.get(e.data.worker) ?? []) fn({ data: e.data.data });
      };
      // Sandboxed, the host has no origin to name (guard.ts): the port goes to whatever the frame holds, and the
      // frame can only hold the viewer's own pages (the page's content policy) or none that runs scripts.
      hiddenFrame(hostUrl, 'KTX2 picture decoder', (win) => win.postMessage({ hypersolKtx2: true }, '*', [channel.port2]));
    }));
  let next = 0;
  return () => {
    const id = next++;
    const heard = new Set<(e: { data: unknown }) => void>();
    listeners.set(id, heard);
    const stand = {
      addEventListener: (_type: string, fn: (e: { data: unknown }) => void) => heard.add(fn),
      postMessage: (msg: unknown, transfer: Transferable[] = []) => void connect().then((port) => port.postMessage({ worker: id, op: 'post', msg }, transfer)),
      terminate: () => {
        listeners.delete(id);
        if (host) void host.then((port) => port.postMessage({ worker: id, op: 'terminate' }));
      },
    };
    return stand as unknown as Worker;
  };
}

/** Releases the decoders' workers. */
export function disposeDecoders(d: Decoders): void {
  d.draco.dispose();
  d.ktx2.dispose();
}
