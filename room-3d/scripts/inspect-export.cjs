const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const bytes = fs.readFileSync(path.join(root, 'assets/room3d/qianyu-room.glb'));
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
const targets = gltf.nodes.filter(n => n.extras?.interaction);
assert(!gltf.nodes.some(n => n.name === 'studio_wall'), 'Open studio must not contain an opaque wall');
const glassWall = gltf.nodes.find(n => n.name === 'studio_glass_wall');
assert(glassWall, 'Glass backdrop is required');
const glassMaterial = gltf.materials[gltf.meshes[glassWall.mesh].primitives[0].material];
assert.equal(glassMaterial.alphaMode, 'BLEND');
assert(glassMaterial.pbrMetallicRoughness.baseColorFactor[3] < .25, 'Wall must stay translucent');
assert(gltf.nodes.some(n => n.name === 'floor_lamp_bulb'), 'Bulb must remain independently controllable');
assert(gltf.nodes.filter(n => n.extras?.room_group === 'record').length <= 4, 'Record grooves must be batched');
assert.equal(gltf.nodes.filter(n => /^about_image/.test(n.name)).length, 1, 'Exactly one wall photograph');
for (const key of ['cv', 'photos', 'music', 'research', 'paper', 'books', 'about', 'lamp']) {
  assert(targets.some(n => n.extras.interaction === key), `Missing click target: ${key}`);
}
const sheet = gltf.nodes.find(n => n.name === 'whiteboard_paper');
assert(gltf.meshes[sheet.mesh].primitives[0].attributes.TEXCOORD_0 !== undefined, 'Whiteboard needs UVs');
const images = gltf.images.map(i => ({name: i.name, bytes: gltf.bufferViews[i.bufferView].byteLength}));
const triangles = gltf.meshes.reduce((n, m) => n + m.primitives.reduce((a, p) => a + (p.indices ? gltf.accessors[p.indices].count / 3 : 0), 0), 0);
console.log(JSON.stringify({bytes: bytes.length, meshes: gltf.meshes.length, triangles, images, textured: gltf.materials.filter(m => m.pbrMetallicRoughness?.baseColorTexture).length, interactions: [...new Set(targets.map(n => n.extras.interaction))]}, null, 2));
