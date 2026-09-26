import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { Store } from './database';
import { answerHistory, inProcess, WorkerHistory, type HistoryAnswer, type HistoryMessage, type WorkerLike } from './history-backend';

/** A stand-in worker: answers on a later turn, like a real thread. */
class FakeWorker extends EventEmitter implements WorkerLike {
  posted = 0;
  constructor(private readonly store: Store) {
    super();
  }
  postMessage(m: HistoryMessage): void {
    this.posted += 1;
    setTimeout(() => this.emit('message', answerHistory(this.store.history, m) satisfies HistoryAnswer), 1);
  }
  terminate(): void {
    this.emit('exit', 1);
  }
}

describe('history through a worker (milestone 10, GitHub issue #4)', () => {
  it('records, titles, searches, lists, deletes, and clears through messages', async () => {
    const store = new Store(':memory:');
    const worker = new FakeWorker(store);
    const h = new WorkerHistory(worker, inProcess(store.history));
    const id = await h.record('https://a.example/', 'https://a.example/');
    await h.updateTitle(id, 'Page A');
    await h.record('https://b.example/', 'Page B');
    expect((await h.search('page a', 10)).map((e) => e.url)).toEqual(['https://a.example/']);
    expect((await h.recent(10)).map((e) => e.title)).toEqual(['Page B', 'Page A']);
    await h.delete(id);
    expect(await h.search('page a', 10)).toEqual([]);
    await h.clear();
    expect(await h.recent(10)).toEqual([]);
    expect(worker.posted).toBe(9);
    expect(h.working).toBe(true);
  });

  it('passes errors back as errors', async () => {
    const store = new Store(':memory:');
    store.close();
    const h = new WorkerHistory(new FakeWorker(store), inProcess(store.history));
    await expect(h.search('x', 1)).rejects.toThrow();
  });

  it('if the worker fails, waiting requests fail and later ones use the main thread', async () => {
    const store = new Store(':memory:');
    const worker = new FakeWorker(store);
    worker.postMessage = () => undefined; // never answers
    const problems: string[] = [];
    const h = new WorkerHistory(worker, inProcess(store.history), (m) => problems.push(m));
    const waiting = h.search('x', 1);
    worker.emit('error', new Error('boom'));
    await expect(waiting).rejects.toThrow(/boom/);
    expect(h.working).toBe(false);
    expect(problems).toEqual(['History worker failed: boom']);
    await h.record('https://c.example/', 'Page C');
    expect((await h.recent(5)).map((e) => e.title)).toEqual(['Page C']);
  });
});
