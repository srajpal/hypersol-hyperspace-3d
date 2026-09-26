import type { HistoryEntry } from '../../shared/data';
import type { HistoryStore } from './history';

/**
 * History as the rest of the main process uses it: every call answers
 * later, so the work can happen in a worker thread (milestone 10, GitHub
 * issue #4). inProcess() runs it on the main thread (unit tests, and the
 * fallback if the worker cannot start).
 */
export interface HistoryBackend {
  record(url: string, title: string): Promise<number>;
  updateTitle(id: number, title: string): Promise<void>;
  search(query: string, limit: number): Promise<HistoryEntry[]>;
  recent(limit: number): Promise<HistoryEntry[]>;
  delete(id: number): Promise<void>;
  clear(): Promise<void>;
  close(): void;
}

export type HistoryOp = 'record' | 'updateTitle' | 'search' | 'recent' | 'delete' | 'clear';
export interface HistoryMessage {
  id: number;
  op: HistoryOp;
  args: unknown[];
}
export type HistoryAnswer = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string };

/** Runs one request against a history store; used by the worker and by the tests. Never throws. */
export function answerHistory(store: HistoryStore, m: HistoryMessage): HistoryAnswer {
  try {
    const a = m.args;
    let value: unknown = null;
    switch (m.op) {
      case 'record':
        value = store.record(String(a[0]), String(a[1]));
        break;
      case 'updateTitle':
        store.updateTitle(Number(a[0]), String(a[1]));
        break;
      case 'search':
        value = store.search(String(a[0]), Number(a[1]));
        break;
      case 'recent':
        value = store.recent(Number(a[0]));
        break;
      case 'delete':
        store.delete(Number(a[0]));
        break;
      case 'clear':
        store.clear();
        break;
    }
    return { id: m.id, ok: true, value };
  } catch (e) {
    return { id: m.id, ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** History on the calling thread. */
export function inProcess(store: HistoryStore): HistoryBackend {
  const run = <T>(fn: () => T) => new Promise<T>((resolve, reject) => {
    try {
      resolve(fn());
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
  return {
    record: (url, title) => run(() => store.record(url, title)),
    updateTitle: (id, title) => run(() => store.updateTitle(id, title)),
    search: (query, limit) => run(() => store.search(query, limit)),
    recent: (limit) => run(() => store.recent(limit)),
    delete: (id) => run(() => store.delete(id)),
    clear: () => run(() => store.clear()),
    close: () => undefined,
  };
}

/** What WorkerHistory needs of a worker thread (a stand-in in the unit tests). */
export interface WorkerLike {
  postMessage(message: HistoryMessage): void;
  on(event: 'message', listener: (answer: HistoryAnswer) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  terminate(): unknown;
}

/**
 * History in a worker thread. If the worker fails or stops, waiting
 * requests are answered with the error and later ones go to the fallback
 * on the main thread, so history keeps working.
 */
export class WorkerHistory implements HistoryBackend {
  private nextId = 1;
  private readonly waiting = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private broken: string | null = null;

  constructor(
    private readonly worker: WorkerLike,
    private readonly fallback: HistoryBackend,
    private readonly onProblem: (message: string) => void = () => undefined,
  ) {
    worker.on('message', (answer) => {
      const w = this.waiting.get(answer.id);
      if (!w) return;
      this.waiting.delete(answer.id);
      if (answer.ok) w.resolve(answer.value);
      else w.reject(new Error(answer.error));
    });
    worker.on('error', (e) => this.fail(`History worker failed: ${e.message}`));
    worker.on('exit', (code) => this.fail(`History worker stopped (${code})`));
  }

  /** Whether requests still go to the worker. */
  get working(): boolean {
    return this.broken === null;
  }

  private fail(message: string): void {
    if (this.broken) return;
    this.broken = message;
    this.onProblem(message);
    for (const w of this.waiting.values()) w.reject(new Error(message));
    this.waiting.clear();
  }

  private ask<T>(op: HistoryOp, args: unknown[], viaFallback: () => Promise<T>): Promise<T> {
    if (this.broken) return viaFallback();
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.waiting.set(id, { resolve: resolve as (v: unknown) => void, reject });
      this.worker.postMessage({ id, op, args });
    });
  }

  record(url: string, title: string): Promise<number> {
    return this.ask('record', [url, title], () => this.fallback.record(url, title));
  }
  updateTitle(id: number, title: string): Promise<void> {
    return this.ask('updateTitle', [id, title], () => this.fallback.updateTitle(id, title));
  }
  search(query: string, limit: number): Promise<HistoryEntry[]> {
    return this.ask('search', [query, limit], () => this.fallback.search(query, limit));
  }
  recent(limit: number): Promise<HistoryEntry[]> {
    return this.ask('recent', [limit], () => this.fallback.recent(limit));
  }
  delete(id: number): Promise<void> {
    return this.ask('delete', [id], () => this.fallback.delete(id));
  }
  clear(): Promise<void> {
    return this.ask('clear', [], () => this.fallback.clear());
  }
  close(): void {
    this.broken ??= 'closed';
    void this.worker.terminate();
  }
}
