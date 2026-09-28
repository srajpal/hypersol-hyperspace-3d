// Milestone 19 (V3): the page's script still hears clicks on things with click actions.
window.clicks = [];
holoml.on('click', (e) => {
  window.clicks.push({ thing: e.thing ? e.thing.id : null, point: e.point !== null, button: e.button });
});
