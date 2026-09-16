// Rules, DOM, real Three.js raycasting and mesh synchronization; no GPU claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'../..');
(async()=>{
  const THREE=await import(pathToFileURL(path.join(root,'room-3d/web/node_modules/three/build/three.module.js')));
  const {Chess}=await import(pathToFileURL(path.join(root,'room-3d/web/node_modules/chess.js/dist/esm/chess.js')));
  const dom=new JSDOM(`<section id="room-experience"><button id="room-chess-trigger"></button><canvas id="canvas"></canvas>${fs.readFileSync(path.join(root,'_includes/room-chess.html'),'utf8')}</section>`,{pretendToBeVisual:true});
  const w=dom.window,d=w.document,$=id=>d.getElementById(id);
  w.matchMedia=()=>({matches:true,addEventListener(){}});
  w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},fillText(){}});
  w.HTMLElement.prototype.setPointerCapture=w.HTMLElement.prototype.releasePointerCapture=()=>{};
  const frames=[];
  const context=vm.createContext({console,window:w,document:d,performance,requestAnimationFrame:fn=>frames.push(fn)});
  const cache=new Map();
  function synthetic(name,values){if(cache.has(name))return cache.get(name);const mod=new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});cache.set(name,mod);return mod;}
  const models={three:synthetic('three',THREE),'chess.js':synthetic('chess.js',{Chess})};
  async function moduleAt(file){
    if(cache.has(file))return cache.get(file);
    if(file.endsWith('.json'))return synthetic(file,{default:JSON.parse(fs.readFileSync(file,'utf8'))});
    const mod=new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,mod);
    await mod.link((name,ref)=>models[name]||moduleAt(path.resolve(path.dirname(ref.identifier),name)));return mod;
  }
  const module=await moduleAt(path.join(root,'room-3d/web/src/chess-corner.js'));await module.evaluate();
  const studyModule=cache.get(path.join(root,'room-3d/web/src/chess-study.js'));
  const {openings,createStudy}=studyModule.namespace;
  for(let i=0;i<openings.length;i++){
    const study=createStudy();study.load(i);const expected=study.game.fen();study.start();
    while(study.ply<study.line.length)study.step(1);
    assert.equal(study.game.fen(),expected);study.reset();assert.equal(study.game.fen(),expected);
  }
  const {createChessCorner,squarePosition,pointSquare}=module.namespace;
  for(const file of 'abcdefgh')for(let rank=1;rank<=8;rank++)assert.equal(pointSquare(squarePosition(file+rank)),file+rank);
  assert.equal(pointSquare(new THREE.Vector3(0,0,0)),null);
  // Load the shipped GLB's actual geometry/transforms. Only texture decoding is
  // omitted: no browser/GPU is required to verify piece origins and raycasting.
  const {GLTFLoader}=await import(pathToFileURL(path.join(root,'room-3d/web/node_modules/three/examples/jsm/loaders/GLTFLoader.js')));
  const original=fs.readFileSync(path.join(root,'assets/room3d/qianyu-room.glb'));
  const jsonLength=original.readUInt32LE(12),gltf=JSON.parse(original.subarray(20,20+jsonLength));
  gltf.materials=gltf.materials.map(()=>({pbrMetallicRoughness:{baseColorFactor:[1,1,1,1]}}));gltf.images=[];gltf.textures=[];
  const json=Buffer.from(JSON.stringify(gltf)),padding=(4-json.length%4)%4;
  const jsonChunk=Buffer.concat([json,Buffer.alloc(padding,32)]),bin=original.subarray(20+jsonLength);
  const glb=Buffer.alloc(20+jsonChunk.length+bin.length);original.copy(glb,0,0,20);
  glb.writeUInt32LE(glb.length,8);glb.writeUInt32LE(jsonChunk.length,12);jsonChunk.copy(glb,20);bin.copy(glb,20+jsonChunk.length);
  const loaded=await new Promise((resolve,reject)=>new GLTFLoader().parse(glb.buffer.slice(glb.byteOffset,glb.byteOffset+glb.byteLength),'',resolve,reject));
  const model=loaded.scene,scene=new THREE.Scene();scene.add(model);model.updateMatrixWorld(true);
  const initialFen=JSON.parse(fs.readFileSync(path.join(root,'room-3d/chess-position.json'),'utf8')).fen;
  const expectedPieces=new Chess(initialFen).board().flat().filter(Boolean);
  model.traverse(obj=>{if(obj.userData.chess_piece){
    const position=obj.getWorldPosition(new THREE.Vector3()),square=pointSquare(position);
    assert(expectedPieces.some(p=>p.square===square&&p.color+p.type===obj.userData.chess_piece),'Exported piece origin/type must match the original FEN');
    assert(Math.abs(position.y-2.319)<.001,'Exported pieces must stand on the live board surface');
  }});
  const camera=new THREE.PerspectiveCamera(32,1,.1,100);camera.position.set(5.12,6.7,2.7);camera.lookAt(5.12,2.36,.75);camera.updateMatrixWorld();
  const canvas=$('canvas');canvas.getBoundingClientRect=()=>({left:0,top:0,width:800,height:800});
  const controls={enabled:true},focus=[],exits=[];
  const corner=createChessCorner({scene,model,camera,canvas,controls,requestRender:()=>scene.updateMatrixWorld(true),markShadows(){},onFocus:n=>focus.push(n),onExit:n=>exits.push(n)});
  const click=id=>$(id).click();
  const clickSquare=sq=>$('chess-keyboard-board').querySelector(`[data-square="${sq}"]`).click();
  const pieces=()=>scene.getObjectByName('live_chess_pieces');
  function synced(){
    const board=corner.study.game.board().flat().filter(Boolean);assert.equal(pieces().children.length,board.length);
    for(const piece of board){const mesh=pieces().children.find(m=>m.userData.square===piece.square);assert(mesh);assert(mesh.position.distanceTo(squarePosition(piece.square))<1e-6);}
  }
  assert.equal(pieces().children.length,30);click('room-chess-trigger');assert(corner.active);assert.equal(focus.at(-1),'chess');
  click('chess-next');assert.equal($('chess-page-number').textContent,'2 / 7');assert.equal(corner.study.opening.id,'sicilian','Browsing must not replace the active game');
  click('chess-apply');assert.equal(corner.study.opening.id,'italian');synced();
  click('chess-start');assert.equal(pieces().children.length,32);synced();
  clickSquare('e2');assert.equal(d.querySelectorAll('#chess-keyboard-board .legal').length,2);
  const start=corner.study.game.fen();clickSquare('e5');assert.equal(corner.study.game.fen(),start);
  clickSquare('e4');assert.equal(corner.study.game.get('e4').type,'p');synced();
  click('chess-undo');assert.equal(corner.study.game.fen(),start);synced();
  // Actual Three.js ray/plane picking: drag e2 to e4, cancel e7, then complete it.
  function pointer(type,square,id=1){const p=squarePosition(square).project(camera);const e=new w.MouseEvent(type,{clientX:(p.x+1)*400,clientY:(1-p.y)*400,button:0,bubbles:true,cancelable:true});Object.defineProperty(e,'pointerId',{value:id});canvas.dispatchEvent(e);}
  pointer('pointerdown','e2');assert.equal(controls.enabled,false);pointer('pointermove','e4');pointer('pointerup','e4');assert.equal(controls.enabled,true);assert(corner.study.game.get('e4'));synced();
  pointer('pointerdown','e7');pointer('pointermove','e5');pointer('pointercancel','e5');assert.equal(controls.enabled,true);assert(corner.study.game.get('e7'));synced();
  pointer('pointerdown','e7');pointer('pointermove','e5');pointer('pointerup','e5');assert(corner.study.game.get('e5'));synced();
  // Special moves synchronize both moved/captured pieces, not just the selected mesh.
  corner.study.game.load('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');clickSquare('e1');clickSquare('g1');assert.equal(corner.study.game.get('f1').type,'r');synced();
  corner.study.game.load('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2');clickSquare('e5');clickSquare('d6');assert.equal(corner.study.game.get('d5'),undefined);synced();
  corner.study.game.load('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');$('chess-promotion').value='n';clickSquare('a7');clickSquare('a8');assert.equal(corner.study.game.get('a8').type,'n');synced();
  click('chess-reset');synced();
  const cell=$('chess-keyboard-board').querySelector('[data-square="a1"]');cell.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(d.activeElement.dataset.square,'b1');
  d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(corner.active,false);assert.equal(panelHidden(),true);assert.equal(controls.enabled,true);
  function panelHidden(){return $('chess-study').hidden;}
  corner.open(true);assert.equal(focus.at(-1),'chessbook');click('chess-exit');assert.equal(corner.active,false);assert.equal(exits.at(-1),true);
  console.log('PASS: 7 legal openings/replay, browsing vs applying, raycast dragging, cancellation, illegal moves, undo, castling, en passant, promotion, mesh-square sync, keyboard and Escape.');
})().catch(error=>{console.error(error);process.exitCode=1;});
