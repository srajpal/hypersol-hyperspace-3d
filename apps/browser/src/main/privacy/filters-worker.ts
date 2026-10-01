/**
 * Builds the filter engine from downloaded list texts in a worker
 * thread: parsing the lists takes most of a second, too long to hold up
 * the main process (see GitHub issue #4). Gets { lists, starter, scripts }
 * (filters-build.ts) and answers with the engine's saved form, or { error }.
 */
import { parentPort } from 'node:worker_threads';
import { buildEngine } from './filters-build';

interface Job {
  lists: string[];
  starter: Uint8Array;
  scripts: string;
}

parentPort?.once('message', (job: Job) => {
  try {
    const bin = buildEngine(job.lists, job.starter, job.scripts);
    parentPort?.postMessage({ bin }, [bin.buffer as ArrayBuffer]);
  } catch (e) {
    parentPort?.postMessage({ error: e instanceof Error ? e.message : String(e) });
  }
});
