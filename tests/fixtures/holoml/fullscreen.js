// GitHub issue #75: a click on the scene asks for full screen, as a game in HoloML might.
window.fullscreenEvents = [];
document.addEventListener('fullscreenchange', () => window.fullscreenEvents.push(document.fullscreenElement ? 'in' : 'out'));
holoml.on('click', () => {
  document.documentElement.requestFullscreen().catch((e) => window.fullscreenEvents.push('refused:' + e.name));
});
