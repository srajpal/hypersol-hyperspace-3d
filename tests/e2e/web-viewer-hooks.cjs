// For checks WL1 to WL8 (web-viewer.e2e.ts, GitHub issue #125) only: the
// preload of their plain windows. It marks the HoloML viewer's script on
// the host page as a test run's, as the browser's page preload does in its
// test runs (apps/browser/src/preload/holoml.ts), so the viewer offers its
// test hooks there too (where a link is, the fade, the places). The site
// itself never has it; WV1 to WV8 and PG1 to PG8 run without it.
new MutationObserver((records, observer) => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (node.nodeName === 'SCRIPT' && /\/assets\/viewer\.js$/.test(node.src)) {
        node.dataset.hypersolHolomlTest = '';
        observer.disconnect();
        return;
      }
    }
  }
}).observe(document, { childList: true, subtree: true });
