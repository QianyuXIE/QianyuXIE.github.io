import assert from 'node:assert/strict';
import * as THREE from '../web/node_modules/three/build/three.module.js';
import {createRoomCompanion,createWallNote} from '../web/src/room-companion.js';

const scene=new THREE.Scene();
const pet=createRoomCompanion(scene);
const states=new Set();
let last=pet.cat.position.clone(), meshes=0;
pet.root.traverse(o=>{if(o.isMesh)meshes++;});
assert(meshes<90,'Pet must stay lightweight');
for(let frame=0;frame<4000;frame++) {
  states.add(pet.update(.05));scene.updateMatrixWorld(true);
  assert(pet.cat.position.distanceTo(last)<.06,'No teleporting between waypoints');
  assert(pet.cat.position.z>=4.3 && pet.cat.position.z<=5.5,'Route stays clear of furniture');
  last.copy(pet.cat.position);
  pet.root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite),'Finite animation transforms'));
}
assert.deepEqual([...states].sort(),['drink','play','sleep','walk']);
assert(scene.getObjectByName('cat_water_bowl'));
assert(scene.getObjectByName('cat_toy_ball'));
const text=[];
const ctx=new Proxy({fillText:s=>text.push(s)},{get:(obj,key)=>obj[key]??(()=>{})});
const note=createWallNote(scene,{createElement:()=>({getContext:()=>ctx})});
assert.deepEqual(text,['甜的那顆，','可以給我嗎？']);
assert.equal(note.children.length,2,'Two tape strips');
assert(note.geometry.attributes.position.count>4,'Curved paper, not a rigid rectangle');
console.log(`PASS: ${meshes} pet meshes; all four activities; continuous safe route; finite transforms; note text and paper geometry.`);

if(process.argv.includes('--preview')) {
  const {GLTFExporter}=await import('../web/node_modules/three/examples/jsm/exporters/GLTFExporter.js');
  const {writeFile}=await import('node:fs/promises');
  globalThis.FileReader=class {
    readAsArrayBuffer(blob){blob.arrayBuffer().then(buffer=>{this.result=buffer;this.onloadend?.();});}
  };
  const previewScene=new THREE.Scene();const previewPet=createRoomCompanion(previewScene);
  for(let i=0;i<240;i++)previewPet.update(.05);
  previewPet.root.traverse(o=>{if(o.material?.isShaderMaterial)o.visible=false;});
  const buffer=await new GLTFExporter().parseAsync(previewScene,{binary:true});
  await writeFile(new URL('../../../.tmp-video-review/cat-preview.glb',import.meta.url),Buffer.from(buffer));
}
