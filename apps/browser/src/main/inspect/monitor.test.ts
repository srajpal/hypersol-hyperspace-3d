import { describe, expect, it } from 'vitest';
import { MAX_BATCH, MAX_ENTRIES, MAX_PENDING, parseInspectRequest, type NetEntry } from '../../shared/inspect';
import {
  filterNet,
  formatAge,
  formatBytes,
  formatDuration,
  formatMs,
  fraction,
  levelShown,
  mergeNet,
  netStatus,
  shortName,
} from '../../renderer/inspect-format';
import { declaredBytes, PageMonitor } from './monitor';

describe('PageMonitor', () => {
  it('counts a page load: requests, sizes, blocked and failed ones, and the load time', () => {
    const m = new PageMonitor();
    m.request(7, 1, 'https://a.example/', 'mainFrame', 'GET', 1000);
    m.request(7, 2, 'https://a.example/app.js', 'script', 'GET', 1010);
    m.request(7, 3, 'https://ads.example/x.gif', 'image', 'GET', 1020);
    m.request(7, 4, 'https://a.example/gone.css', 'stylesheet', 'GET', 1030);
    m.completed(7, 1, 200, 5000, false, 1100);
    m.completed(7, 2, 200, -1, true, 1050);
    m.failed(7, 3, 'net::ERR_BLOCKED_BY_CLIENT', 1021);
    m.failed(7, 4, 'net::ERR_CONNECTION_REFUSED', 1040);
    m.pageFinished(7, 1400);
    const s = m.snapshot(7, 0, 0);
    expect(s.page).toMatchObject({ url: 'https://a.example/', secure: true, loadMs: 400, requests: 4, bytes: 5000, blocked: 1, failed: 1 });
    expect(s.net.map((e) => [e.url.split('/').pop(), e.status, e.bytes, e.ms, e.blocked])).toEqual([
      ['', 200, 5000, 100, false],
      ['app.js', 200, -1, 40, false],
      ['x.gif', 0, -1, 1, true],
      ['gone.css', 0, -1, 10, false],
    ]);
  });

  it('sends only what changed, including requests that finished since', () => {
    const m = new PageMonitor();
    m.request(1, 1, 'http://a.example/', 'mainFrame', 'GET', 0);
    m.request(1, 2, 'http://a.example/slow', 'xhr', 'GET', 0);
    const first = m.snapshot(1, 0, 0);
    const since = Math.max(...first.net.map((e) => e.rev));
    expect(m.snapshot(1, since, 0).net).toEqual([]);
    m.completed(1, 2, 204, 0, false, 30);
    const next = m.snapshot(1, since, 0).net;
    expect(next.map((e) => [e.seq, e.status])).toEqual([[2, 204]]);
  });

  it('starts afresh for a new page, and keeps its numbers rising', () => {
    const m = new PageMonitor();
    m.request(1, 1, 'http://a.example/', 'mainFrame', 'GET', 0);
    m.console(1, 'info', 'old', '', 0, 0);
    const a = m.snapshot(1, 0, 0);
    m.request(1, 2, 'http://b.example/', 'mainFrame', 'GET', 10);
    m.pageCommitted(1, 'http://b.example/', 20);
    const b = m.snapshot(1, 0, 0);
    expect(b.pageNumber).toBe(a.pageNumber + 1);
    expect(b.page.url).toBe('http://b.example/');
    expect(b.console).toEqual([]);
    expect(b.net[0]!.rev).toBeGreaterThan(a.net[0]!.rev);
  });

  it('keeps console messages with their levels, caps them, and clears them', () => {
    const m = new PageMonitor();
    m.request(1, 1, 'http://a.example/', 'mainFrame', 'GET', 0);
    m.console(1, 'warning', 'careful', 'http://a.example/app.js', 12, 5);
    expect(m.snapshot(1, 0, 0).console[0]).toMatchObject({ level: 'warning', message: 'careful', line: 12 });
    for (let i = 0; i < MAX_ENTRIES + 20; i++) m.console(1, 'info', `m${i}`, '', 0, 0);
    const all = m.snapshot(1, 0, 0).console;
    expect(all).toHaveLength(MAX_BATCH); // the oldest first, a batch at a time
    m.clearConsole(1);
    expect(m.snapshot(1, 0, 0).console).toEqual([]);
  });

  it('caps the request list and forgets closed tabs', () => {
    const m = new PageMonitor();
    m.request(1, 0, 'http://a.example/', 'mainFrame', 'GET', 0);
    for (let i = 1; i <= MAX_ENTRIES + 50; i++) m.request(1, i, `http://a.example/${i}`, 'image', 'GET', 0);
    let since = 0;
    let seen = 0;
    for (;;) {
      const net = m.snapshot(1, since, 0).net;
      if (net.length === 0) break;
      seen += net.length;
      since = Math.max(...net.map((e) => e.rev));
    }
    expect(seen).toBe(MAX_ENTRIES);
    m.forget(1);
    expect(m.snapshot(1, 0, 0).page.url).toBe('');
  });

  it("shows the certificate Chromium checked for the page's host", () => {
    const m = new PageMonitor();
    m.certificate({ host: 'A.example', subject: 'a.example', issuer: 'Test CA', validExpiry: 2_000_000_000, verification: 'OK' });
    m.request(1, 1, 'https://a.example/x', 'mainFrame', 'GET', 0);
    expect(m.snapshot(1, 0, 0).page.cert).toMatchObject({ issuer: 'Test CA', verification: 'OK' });
    m.request(1, 2, 'http://a.example/x', 'mainFrame', 'GET', 0);
    m.pageCommitted(1, 'http://a.example/x', 1);
    expect(m.snapshot(1, 0, 0).page.cert).toBeNull(); // not over HTTPS
  });

  it('keeps the showing page when a request for a new page never arrives: a download, or "no content" (review of 2026-09-30, M8)', () => {
    const m = new PageMonitor();
    m.request(1, 1, 'https://a.example/', 'mainFrame', 'GET', 0);
    m.pageCommitted(1, 'https://a.example/', 5);
    m.request(1, 2, 'https://a.example/app.js', 'script', 'GET', 10);
    m.completed(1, 1, 200, 900, false, 8);
    m.completed(1, 2, 200, 100, false, 20);
    m.console(1, 'info', 'hello', '', 0, 20);
    m.pageFinished(1, 30);
    const before = m.snapshot(1, 0, 0);
    // A link to a file: the request starts as a page load, and ends as a download.
    m.request(1, 3, 'https://files.example/big.zip', 'mainFrame', 'GET', 100);
    m.completed(1, 3, 200, 5000, false, 150);
    m.pageFinished(1, 160);
    const after = m.snapshot(1, 0, 0);
    expect(after.pageNumber).toBe(before.pageNumber); // the shell keeps its lists
    expect(after.page).toMatchObject({ url: 'https://a.example/', loadMs: 30, requests: 3, bytes: 6000 });
    expect(after.console.map((c) => c.message)).toEqual(['hello']);
    expect(after.net.map((e) => e.url)).toEqual(['https://a.example/', 'https://a.example/app.js', 'https://files.example/big.zip']);
    // The next page that does arrive starts from its own request only.
    m.request(1, 4, 'https://b.example/', 'mainFrame', 'GET', 200);
    m.request(1, 5, 'https://a.example/beacon', 'ping', 'POST', 201); // the old page, on its way out
    expect(m.snapshot(1, 0, 0).page).toMatchObject({ url: 'https://a.example/', requests: 5 });
    m.pageCommitted(1, 'https://b.example/', 210);
    const next = m.snapshot(1, 0, 0);
    expect(next.pageNumber).toBeGreaterThan(after.pageNumber);
    expect(next.page).toMatchObject({ url: 'https://b.example/', requests: 2, bytes: 0 });
    expect(next.console).toEqual([]);
    m.completed(1, 4, 200, 700, false, 260);
    expect(m.snapshot(1, 0, 0).page.bytes).toBe(700);
  });

  it('a page reached without a request (history) starts afresh, and the same page again does not', () => {
    const m = new PageMonitor();
    m.request(1, 1, 'https://a.example/', 'mainFrame', 'GET', 0);
    m.pageCommitted(1, 'https://a.example/', 5);
    const first = m.snapshot(1, 0, 0).pageNumber;
    m.pageCommitted(1, 'https://a.example/#top', 6);
    expect(m.snapshot(1, 0, 0).pageNumber).toBe(first);
    m.pageCommitted(1, 'https://c.example/', 50);
    expect(m.snapshot(1, 0, 0)).toMatchObject({ pageNumber: first + 1, page: { url: 'https://c.example/', requests: 0 } });
  });

  it('bounds requests still waiting as well as the list (issue #13)', () => {
    const m = new PageMonitor();
    m.request(1, 0, 'http://a.example/', 'mainFrame', 'GET', 0);
    for (let i = 1; i <= 10_000; i++) m.request(1, i, `http://a.example/held-${i}`, 'xhr', 'GET', i);
    expect(m.pendingCount(1)).toBe(MAX_PENDING);
    expect(m.snapshot(1, 0, 0).page.requests).toBe(10_001); // still counted
    m.completed(1, 1, 200, 10, false, 20_000); // no longer followed: ignored, no error
    m.completed(1, 10_000, 200, 10, false, 20_000);
    expect(m.snapshot(1, 0, 0).page.bytes).toBe(10);
    m.request(1, 20_000, 'http://b.example/', 'mainFrame', 'GET', 30_000);
    m.pageCommitted(1, 'http://b.example/', 30_001); // a new page starts empty
    expect(m.pendingCount(1)).toBe(1);
    m.forget(1);
    expect(m.pendingCount(1)).toBe(0);
  });

  it("keeps private tabs' certificates apart, and forgets them with the last private tab (issue #15)", () => {
    const m = new PageMonitor();
    m.certificate({ host: 'secret.example', subject: 's', issuer: 'Private CA', validExpiry: 1, verification: 'OK' }, true);
    m.request(1, 1, 'https://secret.example/', 'mainFrame', 'GET', 0);
    expect(m.snapshot(1, 0, 0, false).page.cert).toBeNull(); // a normal tab does not see it
    expect(m.snapshot(1, 0, 0, true).page.cert?.issuer).toBe('Private CA');
    m.forgetPrivateCerts();
    expect(m.snapshot(1, 0, 0, true).page.cert).toBeNull();
  });

  it('reads a declared size', () => {
    expect(declaredBytes({ 'Content-Length': ['1234'] })).toBe(1234);
    expect(declaredBytes({ 'content-type': ['text/html'] })).toBe(-1);
    expect(declaredBytes(undefined)).toBe(-1);
  });
});

describe('parseInspectRequest', () => {
  it('accepts well-formed requests and refuses the rest', () => {
    expect(parseInspectRequest({ op: 'inspect.snapshot', tab: 3, sinceNet: 0, sinceConsole: 5 })).toHaveProperty('request');
    expect(parseInspectRequest({ op: 'inspect.devtools', tab: 3 })).toEqual({ request: { op: 'inspect.devtools', tab: 3 } });
    expect(parseInspectRequest({ op: 'inspect.snapshot', tab: 3, sinceNet: -1, sinceConsole: 0 })).toHaveProperty('error');
    expect(parseInspectRequest({ op: 'inspect.devtools', tab: 0 })).toHaveProperty('error');
    expect(parseInspectRequest({ op: 'inspect.eval', tab: 3 })).toEqual({ error: 'Unknown request: inspect.eval' });
  });
});

describe('instrument panel wording', () => {
  const entry = (over: Partial<NetEntry>): NetEntry => ({
    seq: 1, rev: 1, url: 'https://a.example/js/app.js?v=2', type: 'script', method: 'GET', status: 200, bytes: 2048, fromCache: false, ms: 12, blocked: false, error: '',
    ...over,
  });

  it('formats sizes, times, durations, and ages', () => {
    expect([formatBytes(-1), formatBytes(512), formatBytes(2048), formatBytes(3 * 1024 * 1024)]).toEqual(['—', '512 B', '2.0 KB', '3.0 MB']);
    expect([formatMs(-1), formatMs(42), formatMs(1500)]).toEqual(['…', '42 ms', '1.50 s']);
    expect([formatDuration(65), formatDuration(3725)]).toEqual(['1:05', '1:02:05']);
    expect([formatAge(0, 1000), formatAge(0, 86_400_000), formatAge(0, 5 * 86_400_000)]).toEqual(['today', '1 day', '5 days']);
    expect([fraction(5, 10), fraction(50, 10), fraction(1, 0)]).toEqual([0.5, 1, 0]);
  });

  it('filters the console by level and the network list by type and text', () => {
    expect(['debug', 'info', 'warning', 'error'].filter((l) => levelShown('warnings', l as never))).toEqual(['warning', 'error']);
    expect(levelShown('errors', 'warning')).toBe(false);
    const list = [entry({ seq: 1 }), entry({ seq: 2, type: 'image', url: 'https://a.example/logo.png' })];
    expect(filterNet(list, 'image', '').map((e) => e.seq)).toEqual([2]);
    expect(filterNet(list, 'all', 'APP').map((e) => e.seq)).toEqual([1]);
  });

  it('names statuses and files, and merges updates', () => {
    expect([netStatus(entry({})), netStatus(entry({ blocked: true })), netStatus(entry({ status: 0, error: 'net::ERR_CONNECTION_REFUSED' })), netStatus(entry({ status: 0 }))]).toEqual([
      '200',
      'BLOCKED',
      'CONNECTION_REF',
      '…',
    ]);
    expect(shortName('https://a.example/js/app.js?v=2')).toBe('app.js?v=2');
    expect(shortName('https://a.example/')).toBe('a.example');
    const merged = mergeNet([entry({ seq: 1, status: 0 }), entry({ seq: 2 })], [entry({ seq: 1, status: 304 }), entry({ seq: 3 })], 2);
    expect(merged.map((e) => [e.seq, e.status])).toEqual([
      [2, 200],
      [3, 200],
    ]);
  });
});
