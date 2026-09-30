/**
 * The history worker thread (milestone 10, GitHub issue #4): its own
 * connection to hypersol.sqlite, which the main process has already
 * opened and brought up to date. Answers one request at a time
 * (history-backend.ts), so searches over a long history never hold up
 * the main process.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { answerHistory, type HistoryMessage } from './history-backend';
import { HistoryStore } from './history';
import { connect } from './scrub';

const { path } = workerData as { path: string };
const store = new HistoryStore(connect(path));

parentPort!.on('message', (m: HistoryMessage) => parentPort!.postMessage(answerHistory(store, m)));
