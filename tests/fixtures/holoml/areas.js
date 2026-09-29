// The browser's tests (milestone 20): a page script hears groups that load by area come and go, and reads `loaded`.
const log = [];
window.loadLog = log;
const status = holoml.find('status');
holoml.on('load', (e) => {
  log.push(`${e.thing?.id ?? null}:${e.loaded}`);
  status.text = log.join(' ');
});
window.loadedNow = () => ({
  near: holoml.find('near-shelf').loaded,
  far: holoml.find('far-shelf').loaded,
  nearBox: holoml.find('near-box').loaded,
  farCar: holoml.find('far-car').loaded,
  farBox: holoml.find('far-box').loaded,
});
