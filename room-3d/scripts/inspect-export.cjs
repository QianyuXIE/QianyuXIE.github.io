const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const bytes = fs.readFileSync(path.join(root, 'assets/room3d/qianyu-room.glb'));
const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)));
const targets = gltf.nodes.filter(n => n.extras?.interaction);
const chess = gltf.nodes.find(n=>n.name==='chess_board');
assert(chess,'Missing chess table board');
assert.equal(chess.extras.chess_fen,JSON.parse(fs.readFileSync(path.join(root,'room-3d/chess-position.json'),'utf8')).fen);
assert.equal(chess.extras.piece_count,30,'Two pawns have been exchanged in the selected middlegame');
const pieces=gltf.nodes.filter(n=>n.extras?.chess_piece);
assert.equal(pieces.length,30,'Pieces must remain separate, movable meshes');
assert.equal(new Set(pieces.map(n=>n.extras.chess_piece)).size,12,'Every color/type needs a reusable prototype');
for(const side of ['left','right']) {
  const page=gltf.nodes.find(n=>n.name===`chess_book_${side}_page`);
  assert(page&&gltf.meshes[page.mesh].primitives[0].attributes.TEXCOORD_0!==undefined,'Live book page requires UVs');
}
assert(!gltf.nodes.some(n => n.name === 'studio_wall'), 'Open studio must not contain an opaque wall');
const glassWall = gltf.nodes.find(n => n.name === 'studio_glass_wall');
assert(glassWall, 'Glass backdrop is required');
const glassMaterial = gltf.materials[gltf.meshes[glassWall.mesh].primitives[0].material];
assert.equal(glassMaterial.alphaMode, 'BLEND');
assert(glassMaterial.pbrMetallicRoughness.baseColorFactor[3] < .25, 'Wall must stay translucent');
assert(gltf.nodes.some(n => n.name === 'floor_lamp_bulb'), 'Bulb must remain independently controllable');
assert(gltf.nodes.filter(n => n.extras?.room_group === 'record').length <= 4, 'Record grooves must be batched');
assert.equal(gltf.nodes.filter(n => /^about_image/.test(n.name)).length, 1, 'Exactly one wall photograph');
const expectedTargets = JSON.parse(fs.readFileSync(path.join(root, 'room-3d/interaction-targets.json'), 'utf8'));
assert.equal(targets.length, Object.keys(expectedTargets).length, 'One intentional surface per configured action');
for (const target of targets) assert.equal(target.extras.interaction, expectedTargets[target.name], `Unapproved hotspot ${target.name}`);
for (const key of ['cv', 'photos', 'music', 'research', 'paper', 'about', 'lamp', 'books']) {
  assert(targets.some(n => n.extras.interaction === key), `Missing click target: ${key}`);
  assert.equal(targets.filter(n => n.extras.interaction === key).length, 1, `Duplicate entry for ${key}`);
}
assert(gltf.images.some(i => /chungking/.test(i.name)), 'Official film poster must be embedded');
const sheet = gltf.nodes.find(n => n.name === 'whiteboard_paper');
assert(gltf.meshes[sheet.mesh].primitives[0].attributes.TEXCOORD_0 !== undefined, 'Whiteboard needs UVs');
const images = gltf.images.map(i => ({name: i.name, bytes: gltf.bufferViews[i.bufferView].byteLength}));
const triangles = gltf.meshes.reduce((n, m) => n + m.primitives.reduce((a, p) => a + (p.indices ? gltf.accessors[p.indices].count / 3 : 0), 0), 0);
console.log(JSON.stringify({bytes: bytes.length, meshes: gltf.meshes.length, triangles, images, textured: gltf.materials.filter(m => m.pbrMetallicRoughness?.baseColorTexture).length, interactions: [...new Set(targets.map(n => n.extras.interaction))]}, null, 2));
