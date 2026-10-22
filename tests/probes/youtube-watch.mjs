// Loaded into the app's main process by youtube.mjs (NODE_OPTIONS=--import), so the app runs as it does for a
// person, with no automation: Playwright's sets navigator.webdriver, and YouTube then stops every video after
// about 40 seconds ("Something went wrong"), in a bare Electron window too (issue #133, 2026-10-21).
// It watches the first tab's video and prints lines that start with "PROBE". NODE_OPTIONS reaches the app's
// worker threads too (the history worker): it does nothing there.
import { isMainThread } from 'node:worker_threads';

// With --dev, NODE_OPTIONS reaches electron-vite's own Node process too, where there is no Electron app.
if (isMainThread && process.versions.electron) setTimeout(async () => {
  const { app, webContents } = await import('electron');
  const seconds = Number(process.env.HYPERSOL_PROBE_SECONDS ?? 60);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  app.on('web-contents-created', (_e, w) => {
    w.on('console-message', (e) => {
      if (e.level === 'error' && log.length < 40) log.push(`${w.getType()} error: ${String(e.message).slice(0, 200)}`);
    });
    w.on('render-process-gone', (_e2, d) => log.push(`${w.getType()} process gone: ${d.reason}`));
    w.on('did-navigate', (_e2, u) => log.push(`${w.getType()} navigated: ${String(u).slice(0, 100)}`));
  });
  app.whenReady().then(async () => {
    let w;
    for (let i = 0; i < 150 && !(w = webContents.getAllWebContents().find((x) => x.getType() === 'webview')); i++) await sleep(200);
    if (!w) {
      console.log('PROBE no tab appeared');
      app.exit(1);
      return;
    }
    // Counted from when the page has a video: a restart is the video loaded again, or its time going back.
    const COUNT = `(() => { const v = document.querySelector('video'); if (!v) return false; if (!v.__probe) { v.__probe = { loadstart: 0, emptied: 0, seeking: 0, ended: 0, error: 0 }; for (const k of Object.keys(v.__probe)) v.addEventListener(k, () => v.__probe[k]++); } return true; })()`;
    const SAMPLE = `(() => { const v = document.querySelector('video'); const p = document.getElementById('movie_player'); return { t: v ? Math.round(v.currentTime * 10) / 10 : null, paused: v ? v.paused : null, events: v ? v.__probe : null, state: p && p.getPlayerState ? p.getPlayerState() : null, message: (document.querySelector('.ytp-error')?.innerText ?? '').replace(/\\s+/g, ' ').slice(0, 120), webdriver: navigator.webdriver }; })()`;
    // A page that has not finished loading holds executeJavaScript until it has: 5 s, then the page's state.
    const run = (code) =>
      w.isDestroyed()
        ? Promise.resolve('gone')
        : Promise.race([
            w.executeJavaScript(code, false).catch((e) => `script: ${e.message}`),
            sleep(5000).then(() => `no answer${w.isLoading() ? ' (loading)' : ''}`),
          ]);
    for (let i = 0; i < 20 && (await run(COUNT)) !== true; i++) await sleep(1000);
    const samples = [];
    for (let i = 0; i < seconds / 2; i++) {
      await sleep(2000);
      await run(COUNT);
      samples.push(await run(SAMPLE));
    }
    let back = 0;
    for (let i = 1; i < samples.length; i++) {
      const [a, b] = [samples[i - 1], samples[i]];
      if (a && b && typeof a.t === 'number' && typeof b.t === 'number' && b.t + 0.5 < a.t) back++;
    }
    console.log(`PROBE on ${process.platform}: ${w.getURL().slice(0, 80)}`);
    console.log('PROBE times: ' + samples.map((s) => (s && typeof s === 'object' ? `${s.t}${s.paused ? 'p' : ''}` : String(s))).join(' '));
    console.log(`PROBE went back ${back} times; last: ${JSON.stringify(samples.at(-1))}`);
    console.log('PROBE log:\n' + (log.join('\n') || '(nothing)'));
    app.exit(0);
  });
}, 0);
