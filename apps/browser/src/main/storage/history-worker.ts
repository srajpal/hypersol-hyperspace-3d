/**
 * The history worker thread (milestone 10, GitHub issue #4): its own
 * connection to hypersol.sqlite, which the main process has already
 * opened and brought up to date. Answers one request at a time
 * (history-backend.ts), so searches over a long history never hold up
 * the main process.
 */
import { DatabaseSync } from 'node:sqlite';
import { parentPort, workerData } from 'node:worker_threads';
import { answerHistory, type HistoryMessage } from './history-backend';
import { HistoryStore } from './history';

const { path } = workerData as { path: string };
const db = new DatabaseSync(path);
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
const store = new HistoryStore(db);

parentPort!.on('message', (m: HistoryMessage) => parentPort!.postMessage(answerHistory(store, m)));
