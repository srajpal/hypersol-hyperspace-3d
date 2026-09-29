// The browser's tests (milestone 20): a click on a stand-in is a click on its model.
window.clicks = [];
holoml.on('click', (e) => window.clicks.push(e.thing?.id ?? null));
