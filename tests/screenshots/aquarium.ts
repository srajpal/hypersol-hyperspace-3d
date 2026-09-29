/**
 * Places the aquarium's fish as they might pass the tunnel, for its
 * pictures (the example's picture, and the progress screenshots): page
 * code to run with reduced motion on, which holds them where they are put.
 */
export const AQUARIUM_FISH = `() => {
  const put = (id, p, yaw) => { const t = holoml.find(id); if (t) { t.position = p; t.rotation = [0, yaw, 0]; } };
  put('shark-1', [-1.4, 3.8, -1.2], 75);
  put('shark-2', [4.5, 4.7, -10], -110);
  put('turtle-1', [2.7, 3.1, -3.2], -135);
  put('tuna-1', [1.0, 5.0, -6.8], -70);
  put('tuna-2', [2.1, 5.4, -7.6], -65);
  put('barramundi-1', [-4.4, 1.2, -3.5], 120);
  [[-3.3, 1.5, 0.6], [-3.7, 1.8, 0.2], [-3.1, 1.2, -0.2], [-3.9, 1.3, 1.0], [-3.5, 2.0, 1.2], [-4.0, 1.6, -0.5]].forEach((p, i) => put('bream-' + (i + 1), p, 150 + i * 5));
  [[0.2, 5.4, -3.2], [0.6, 5.2, -3.6], [1.0, 5.5, -3.0], [-0.2, 5.1, -3.8], [0.4, 5.7, -4.1], [0.9, 5.0, -4.4], [-0.5, 5.5, -2.9], [1.3, 5.3, -3.9]].forEach((p, i) => put('mackerel-' + (i + 1), p, 100 + i * 3));
  [[-2.9, 0.6, 1.9], [-3.1, 0.7, 2.3]].forEach((p, i) => put('clownfish-' + (i + 1), p, 80 + i * 20));
  put('butterflyfish-1', [2.9, 0.9, 1.2], -100);
}`;
