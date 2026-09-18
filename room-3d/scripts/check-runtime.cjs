// NODE_PATH: temporary QA jsdom installation. Run node --experimental-vm-modules.
// Real OrbitControls + Three math; mocked renderer. Not a GPU/FPS or visual test.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '../..');
(async () => {
  const load = p => import(pathToFileURL(path.join(root, 'room-3d/web/node_modules/three', p)));
  const three = await load('build/three.module.js');
  const { OrbitControls } = await load('examples/jsm/controls/OrbitControls.js');
  const dom = new JSDOM('<div id="room-viewport"><div id="room-webgl"></div></div>', { pretendToBeVisual:true });
  const w = dom.window, d = w.document;
  w.matchMedia = () => ({ matches:false, addEventListener(){} });
  w.HTMLCanvasElement.prototype.getContext = () => ({});
  w.HTMLElement.prototype.setPointerCapture = w.HTMLElement.prototype.releasePointerCapture = () => {};
  Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get:()=>1440 });
  Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get:()=>900 });
  w.HTMLElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:1440,height:900});
  const targets=JSON.parse(fs.readFileSync(path.join(root,'room-3d/interaction-targets.json'),'utf8'));
  let hitCandidates=[];
  class Picker extends three.Raycaster { intersectObjects(objects){hitCandidates=objects;return [];} }
  let renderer, controls, ready, ticks=0;
  const frames=[];
  class Renderer {
    constructor(){ renderer=this; this.domElement=d.createElement('canvas'); this.shadowMap={}; this.sizes=0; this.renders=0; }
    setPixelRatio(v){ this.ratio=v; }
    getPixelRatio(){ return this.ratio; }
    setSize(){ this.sizes++; }
    render(scene,camera){ this.scene=scene; this.camera=camera; this.renders++; scene.updateMatrixWorld(); camera.updateMatrixWorld(); }
  }
  class Controls extends OrbitControls { constructor(...args){ super(...args); controls=this; } }
  class Loader { load(url, fn){ assert(url.includes('20260916')); ready=fn; } }
  class Environment extends three.Group { dispose(){} }
  class PMREM { fromScene(){ return {texture:new three.Texture()}; } dispose(){} }
  const context=vm.createContext({window:w,document:d,console,performance,CustomEvent:w.CustomEvent,ResizeObserver:class{observe(){}},requestAnimationFrame:fn=>frames.push(fn)});
  const dependencies={
    './chess-corner.js':{createChessCorner:()=>null},
    '../../interaction-targets.json':{default:JSON.parse(fs.readFileSync(path.join(root,'room-3d/interaction-targets.json'),'utf8'))},
    three:{...three,WebGLRenderer:Renderer,PMREMGenerator:PMREM,Raycaster:Picker},
    'three/examples/jsm/controls/OrbitControls.js':{OrbitControls:Controls},
    'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader:Loader},
    'three/examples/jsm/environments/RoomEnvironment.js':{RoomEnvironment:Environment}
  };
  const source=new vm.SourceTextModule(fs.readFileSync(path.join(root,'room-3d/web/src/room-runtime.js'),'utf8'),{context});
  await source.link(name=>{
    const values=dependencies[name]; assert(values,`Unexpected import ${name}`);
    return new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v] of Object.entries(values))this.setExport(k,v);},{context});
  });
  await source.evaluate();
  const model=new three.Group();
  for(const name of [...Object.keys(targets),'macbook_air_base','macbook_air_trackpad','studio_floor','studio_glass_wall','floor_lamp_shade','floor_lamp_bulb','lamp_inner','turntable_dust_lid']){
    const mat=new three.MeshPhysicalMaterial({transparent:name.includes('glass')||name.includes('lid'),transmission:name.includes('lid')?.38:0});
    const mesh=new three.Mesh(new three.BoxGeometry(1,1,1),mat);mesh.name=name;model.add(mesh);
  }
  ready({scene:model});
  function settle(){ for(let i=0;frames.length&&i<200;i++){ const batch=frames.splice(0); batch.forEach(fn=>fn(ticks+=16.67)); } assert.equal(frames.length,0,'Idle scene must stop requesting frames'); }
  settle();
  const floor = model.getObjectByName('studio_floor');
  const backdrop = renderer.scene.getObjectByName('studio_backdrop');
  assert(floor.material.isMeshStandardMaterial && floor.material.toneMapped,'Floor must respond to lighting and exposure');
  assert(floor.receiveShadow && backdrop.receiveShadow,'Both surfaces receive real shadows');
  assert.equal(floor.material, backdrop.material,'Continuous sweep must share the floor finish');
  const normals = backdrop.geometry.attributes.normal;
  assert(normals.getY(0) > .9 && normals.getZ(normals.count - 1) > .9,'Sweep turns smoothly from floor to rear wall');
  assert(!renderer.scene.getObjectByName('studio_floor_shadows'),'No double shadow overlay');
  renderer.domElement.dispatchEvent(new w.MouseEvent('pointermove',{clientX:400,clientY:300}));
  assert.deepEqual(Array.from(hitCandidates,o=>o.name).sort(),Object.keys(targets).sort(),'Only seven authored surfaces enter raycasting');
  assert.equal(hitCandidates.filter(o=>o.name.startsWith('macbook')).length,1,'Computer has one click surface');
  assert.equal(controls.mouseButtons.LEFT,three.MOUSE.ROTATE);
  assert.equal(controls.mouseButtons.RIGHT,three.MOUSE.PAN);
  const sizes=renderer.sizes;
  function gesture(button){
    for(const [type,x,y] of [['pointerdown',400,400],['pointermove',500,440],['pointerup',500,440]]){
      const e=new w.MouseEvent(type,{button,buttons:type==='pointerup'?0:button===2?2:1,clientX:x,clientY:y,bubbles:true,cancelable:true});
      Object.defineProperties(e,{pointerId:{value:1},pointerType:{value:'mouse'},pageX:{value:x},pageY:{value:y}});
      renderer.domElement.dispatchEvent(e);
    }
    settle();
  }
  const initialTarget=controls.target.clone(),initialPosition=controls.object.position.clone();
  gesture(0);
  assert(initialPosition.distanceTo(controls.object.position)>.1,'Left drag must rotate');
  assert(initialTarget.distanceTo(controls.target)<1e-7,'Left drag must not pan');
  const panTarget=controls.target.clone();
  gesture(2);
  assert(panTarget.distanceTo(controls.target)>.1,'Right drag must pan');
  assert.equal(renderer.sizes,sizes,'Dragging must not resize the framebuffer');
  const contextMenu=new w.MouseEvent('contextmenu',{cancelable:true});renderer.domElement.dispatchEvent(contextMenu);assert(contextMenu.defaultPrevented);
  const dispatch=(name,detail)=>d.dispatchEvent(new w.CustomEvent(`qianyu-room:${name}`,{detail}));
  dispatch('lamp-changed',{on:true});settle();
  assert(model.getObjectByName('floor_lamp_shade').material.emissiveIntensity>0);
  assert(!renderer.scene.getObjectByName('floor_lamp_spill'),'Lamp spill comes from real light, not a flat overlay');
  assert(renderer.scene.children.some(o=>o.isSpotLight&&o.intensity>0),'Floor lamp must illuminate the floor');
  dispatch('lamp-changed',{on:false});settle();
  assert.equal(model.getObjectByName('floor_lamp_shade').material.emissiveIntensity,0);
  assert(renderer.scene.children.filter(o=>o.isSpotLight).every(o=>o.intensity===0));
  assert.equal(model.getObjectByName('turntable_dust_lid').material.transmission,0);
  assert.equal(model.getObjectByName('studio_glass_wall').castShadow,false);
  dispatch('panel-changed',{open:true});assert.equal(controls.enabled,false);
  dispatch('panel-changed',{open:false});assert.equal(controls.enabled,true);settle();
  console.log('PASS: configured hotspots / one laptop entry; real OrbitControls left rotation/right pan; no drag framebuffer resize; idle loop stops; context menu; lamp emission/light pool; glass fast path; panel control lock. GPU performance unmeasured.');
  controls.dispose();dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
