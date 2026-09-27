// The script of speed.holoml (milestone 18): the slider "pace" sets how
// fast the viewer walks and turns, as Blockworld's does; every change and
// click is kept for the checks.
const pace = holoml.find('pace');
const said = holoml.find('said');
window.__changes = [];
window.__clicks = 0;
holoml.on('click', () => {
  window.__clicks += 1;
});
holoml.on('change', (e) => {
  window.__changes.push([e.thing ? e.thing.id : null, e.value]);
  if (e.thing !== pace) return;
  holoml.viewer.speed = 4 * e.value;
  holoml.viewer.turnSpeed = 180 * e.value;
  pace.text = `Pace ${e.value}×`;
  said.text = `Walking at ${holoml.viewer.speed} m/s`;
});
