// Writes each change the viewer makes in the screen text.
const heard = holoml.find('heard');
holoml.on('change', (e) => {
  heard.text = `${e.thing.id}: ${e.value}`;
});
