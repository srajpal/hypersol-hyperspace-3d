// The browser's tests (milestone 17): a page script that uses the scene API.
const probe = { ran: true, version: holoml.version, events: [], errors: [] };
window.__probe = probe;
const sign = holoml.find('sign');
sign.text = 'Changed by the script';
holoml.find('lamp').intensity = 1.5;
holoml.find('score').text = 'Score: 10\nLevel: 2';
holoml.remove(holoml.find('gone'));
const [added] = holoml.add('<model id="added" src="models/spinner.gltf" position="1 0 2" solid />', holoml.find('stand'));
probe.added = added ? { id: added.id, kind: added.kind, parent: added.parent?.id ?? null, solid: added.solid } : null;
probe.missing = holoml.find('nothing-here');
try {
  holoml.find('car').position = [1, 2];
} catch (e) {
  probe.errors.push(String(e.message));
}
holoml.add('<animate target="#car" attribute="rotation" to="0 90 0" duration="1s" />');
holoml.on('click', (e) => probe.events.push(['click', e.button, e.thing?.id ?? null]));
holoml.on('key', (e) => e.down && probe.events.push(['key', e.key]));
holoml.ready.then(() => (probe.ready = true));
let frames = 0;
const stop = holoml.on('frame', () => {
  frames += 1;
  if (frames === 30) {
    probe.frames = frames;
    stop();
  }
});
