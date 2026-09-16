import * as THREE from 'three';
import { Chess } from 'chess.js';
import { createStudy, openings } from './chess-study.js';

const glyphs = {wk:'♔',wq:'♕',wr:'♖',wb:'♗',wn:'♘',wp:'♙',bk:'♚',bq:'♛',br:'♜',bb:'♝',bn:'♞',bp:'♟'};
const names = {k:'王',q:'后',r:'车',b:'象',n:'马',p:'兵'};
const squares = Array.from({length:64},(_,i)=>'abcdefgh'[i%8]+(8-Math.floor(i/8)));
const center = new THREE.Vector3(5.12,2.319,.75), cell=.222;
export const squarePosition = square => new THREE.Vector3(center.x+(square.charCodeAt(0)-97-3.5)*cell,center.y,center.z-(Number(square[1])-1-3.5)*cell);
export function pointSquare(point) {
  const file=Math.floor((point.x-center.x)/cell+4),rank=Math.floor((center.z-point.z)/cell+4);
  return file>=0&&file<8&&rank>=0&&rank<8 ? 'abcdefgh'[file]+(rank+1) : null;
}

export function createChessCorner({scene,model,camera,controls,canvas,requestRender,markShadows,onFocus,onExit}) {
  const panel=document.getElementById('chess-study');
  if (!panel) return null;
  const root=document.getElementById('room-experience'),$=id=>document.getElementById(id);
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const study=createStudy(),pieces=new THREE.Group(),markers=new THREE.Group();
  pieces.name='live_chess_pieces'; markers.name='chess_move_markers'; scene.add(pieces,markers);
  const templates=new Map();model.updateMatrixWorld(true);
  model.traverse(obj=>{
    if (!obj.userData.chess_piece) return;
    const copy=obj.clone();obj.getWorldQuaternion(copy.quaternion);obj.getWorldScale(copy.scale);
    copy.matrixAutoUpdate=true;copy.visible=true;
    templates.set(obj.userData.chess_piece,copy);obj.visible=false;
  });
  const board=model.getObjectByName('chess_board');
  if (!board || templates.size!==12) throw new Error('Chess model is missing movable piece templates');
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-center.y);
  const leftPage=model.getObjectByName('chess_book_left_page'),rightPage=model.getObjectByName('chess_book_right_page');
  const textures=[];
  let active=false,selected=null,legal=[],page=0,drag=null,blockClick=false,animation=0,flipToken=0,leaf=null,gesture=null;
  let bookVisible=true,focusSquare='a1';
  function changed(shadows=false) { if(shadows)markShadows();requestRender(); }
  function clearMarkers() { for(const m of [...markers.children]){markers.remove(m);m.geometry.dispose();m.material.dispose();} }
  function selection(square) {
    selected=square;legal=square?study.game.moves({square,verbose:true}).map(m=>m.to):[];clearMarkers();
    for(const sq of [...new Set([selected,...legal].filter(Boolean))]) {
      const m=new THREE.Mesh(new THREE.PlaneGeometry(cell*.90,cell*.90),new THREE.MeshBasicMaterial({color:sq===selected?0xc99b43:0x4c9971,transparent:true,opacity:.42,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
      m.rotation.x=-Math.PI/2;m.position.copy(squarePosition(sq));m.position.y=center.y+.003;markers.add(m);
    }
    renderKeyboard();changed();
  }
  function syncPieces(move) {
    const token=++animation;
    for(const obj of [...pieces.children])pieces.remove(obj);
    for(const square of squares){
      const p=study.game.get(square);if(!p)continue;
      const mesh=templates.get(p.color+p.type).clone();mesh.visible=true;mesh.matrixAutoUpdate=true;
      mesh.position.copy(squarePosition(square));mesh.userData={square};mesh.castShadow=true;mesh.receiveShadow=true;pieces.add(mesh);
      if(move && square===move.to && !reduced.matches){
        const from=squarePosition(move.from),to=mesh.position.clone();mesh.position.copy(from);
        const start=performance.now();
        const frame=now=>{if(token!==animation)return;const t=Math.min(1,(now-start)/230),e=1-(1-t)**3;mesh.position.lerpVectors(from,to,e);mesh.position.y+=Math.sin(t*Math.PI)*.06;changed(true);if(t<1)requestAnimationFrame(frame);};
        requestAnimationFrame(frame);
      }
    }
    selection(null);updateStatus();changed(true);
  }
  function updateStatus(message) {
    const game=study.game,turn=game.turn()==='w'?'白方':'黑方';
    const state=game.isCheckmate()?`${turn}被将死，本局结束。`:game.isStalemate()?'逼和，本局结束。':game.isDraw()?'和棋，本局结束。':`${turn}走棋${game.isCheck()?' · 将军':''}`;
    $('chess-status').textContent=message||state;
    $('chess-line-label').textContent=`${study.opening.title} · ${study.exploring?'正在探索变化':`棋谱 ${study.ply} / ${study.line.length} 步`}`;
    $('chess-step-back').disabled=study.ply===0||study.exploring;
    $('chess-step-next').disabled=study.ply===study.line.length||study.exploring;
    $('chess-undo').disabled=game.history().length===0;
  }
  function moveTo(square) {
    if(!selected || !square)return false;
    const move=study.move(selected,square,$('chess-promotion').value);
    if(!move){updateStatus('这个落点不符合走子规则，请选择标记的格子。');return false;}
    syncPieces(move);return true;
  }
  function choose(square) {
    if(!square)return;
    if(study.game.isGameOver()){updateStatus('本局已结束，可以悔棋或重置棋局。');return;}
    const p=study.game.get(square);
    if(p?.color===study.game.turn()) { selection(selected===square?null:square);updateStatus(selected?`已选择 ${square} ${names[p.type]}，请选择落点。`:null); }
    else moveTo(square);
  }
  function diagram(element,game,interactive=false) {
    element.replaceChildren();
    for(let i=0;i<64;i++){
      const square=squares[i],p=game.get(square),el=document.createElement(interactive?'button':'span');
      if((Math.floor(i/8)+i%8)%2)el.classList.add('dark');
      el.textContent=p?glyphs[p.color+p.type]:'';
      if(interactive){
        el.type='button';el.setAttribute('role','gridcell');el.tabIndex=square===focusSquare?0:-1;el.dataset.square=square;
        el.setAttribute('aria-label',`${square} ${p?(p.color==='w'?'白':'黑')+names[p.type]:'空格'}${legal.includes(square)?'，可落子':''}`);
        el.setAttribute('aria-selected',String(square===selected));
        el.classList.toggle('selected',square===selected);el.classList.toggle('legal',legal.includes(square));
        el.addEventListener('click',()=>{focusSquare=square;choose(square);$('chess-keyboard-board').querySelector(`[data-square="${square}"]`)?.focus();});
      }
      element.append(el);
    }
  }
  function renderKeyboard(){diagram($('chess-keyboard-board'),study.game,true);}
  $('chess-keyboard-board').addEventListener('keydown',e=>{
    const offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-8,ArrowDown:8}[e.key];
    if(!offset)return;e.preventDefault();e.stopPropagation();
    const index=squares.indexOf(e.target.dataset.square);focusSquare=squares[Math.max(0,Math.min(63,index+offset))];
    renderKeyboard();$('chess-keyboard-board').querySelector(`[data-square="${focusSquare}"]`).focus();
  });
  function paintPage(side,opening,game) {
    const c=document.createElement('canvas');c.width=512;c.height=1024;const ctx=c.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,512,1024);
    ctx.fillStyle='#345744';ctx.fillRect(side==='left'?485:8,35,2,950);
    ctx.fillStyle='#586d5e';ctx.font='20px Georgia';ctx.fillText('MODERN CHESS OPENINGS',32,70);
    ctx.fillStyle='#203d2b';ctx.font='36px Georgia';
    const title=side==='left'?'OPENING NOTES':opening.english.split(' · ')[0];
    title.split(' ').forEach((word,i)=>ctx.fillText(word,34,160+i*49));
    if(side==='left'){
      ctx.font='25px "Microsoft YaHei", sans-serif';ctx.fillText(opening.title,34,360);
      ctx.font='22px monospace';ctx.fillText(`STUDY ${String(page+1).padStart(2,'0')} / ${openings.length}`,34,420);
      ctx.font='20px "Microsoft YaHei", sans-serif';
      const chars=[...opening.note];for(let i=0;i<chars.length;i+=18)ctx.fillText(chars.slice(i,i+18).join(''),34,510+(i/18)*36);
      ctx.font='18px Georgia';ctx.fillText('Qianyu / opening studies',34,946);
    }else{
      const size=54,startX=40,startY=380;
      for(let i=0;i<64;i++){
        const x=startX+(i%8)*size,y=startY+Math.floor(i/8)*size;
        ctx.fillStyle=(i%8+Math.floor(i/8))%2?'#9db3a4':'#eef2ed';ctx.fillRect(x,y,size,size);
        const p=game.get(squares[i]);if(p){ctx.fillStyle='#183523';ctx.font='46px "Segoe UI Symbol", serif';ctx.textAlign='center';ctx.fillText(glyphs[p.color+p.type],x+size/2,y+43);ctx.textAlign='left';}
      }
      ctx.fillStyle='#526856';ctx.font='18px monospace';ctx.fillText('Click book to turn pages',40,890);
      ctx.fillText('Select a study to set the board',40,925);
    }
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;textures.push(texture);return texture;
  }
  function finishFlip(){if(leaf){scene.remove(leaf);leaf.children.forEach(m=>{m.geometry.dispose();m.material.dispose();});leaf=null;}}
  function turnLeaf(){
    const token=++flipToken;finishFlip();if(reduced.matches||!active)return;
    leaf=new THREE.Group();leaf.position.set(6.91,2.354,.75);
    const m=new THREE.Mesh(new THREE.PlaneGeometry(.65,1.6),new THREE.MeshStandardMaterial({map:rightPage.material.map,side:THREE.DoubleSide,roughness:.85}));
    m.rotation.x=-Math.PI/2;m.position.x=.34;leaf.add(m);scene.add(leaf);
    const began=performance.now();
    const frame=now=>{if(token!==flipToken)return;const t=Math.min(1,(now-began)/420);leaf.rotation.z=Math.PI*t;changed();if(t<1)requestAnimationFrame(frame);else{finishFlip();changed();}};
    requestAnimationFrame(frame);
  }
  function showPage(animate=false){
    ++flipToken;finishFlip();
    const opening=openings[page],preview=new Chess();preview.loadPgn(opening.pgn);
    $('chess-opening-code').textContent=`STUDY ${String(page+1).padStart(2,'0')}`;
    $('chess-opening-title').textContent=opening.title;$('chess-opening-english').textContent=opening.english;
    $('chess-opening-note').textContent=opening.note;$('chess-opening-pgn').textContent=opening.pgn;
    $('chess-page-number').textContent=`${page+1} / ${openings.length}`;diagram($('chess-opening-diagram'),preview);
    $('chess-prev').disabled=page===0;$('chess-next').disabled=page===openings.length-1;
    for(const t of textures.splice(0))t.dispose();
    for(const [side,mesh] of [['left',leftPage],['right',rightPage]]){
      if(!mesh)continue;
      if(!mesh.userData.livePage){mesh.material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85,side:THREE.DoubleSide});mesh.userData.livePage=true;}
      mesh.material.map=paintPage(side,opening,preview);mesh.material.needsUpdate=true;
    }
    const pageEl=$('chess-book-page');pageEl.classList.remove('is-turning');
    if(animate){void pageEl.offsetWidth;pageEl.classList.add('is-turning');if(rightPage)turnLeaf();}
    changed();
  }
  function toggleBook(next=!bookVisible){bookVisible=next;$('chess-opening-book').hidden=!next;$('chess-book-toggle').setAttribute('aria-expanded',String(next));}
  function open(book=false){
    if(drag)cancelDrag();
    if(active&&book){page=(page+1)%openings.length;showPage(true);}
    active=true;root.classList.add('is-chess');panel.hidden=false;
    controls.minDistance=1.6;controls.minPolarAngle=Math.PI*.08;if(book)toggleBook(true);onFocus(book?'chessbook':'chess');
    $('chess-exit').focus({preventScroll:true});updateStatus();changed();
  }
  function close(reset=true){
    if(!active)return;cancelDrag();active=false;animation++;flipToken++;finishFlip();
    root.classList.remove('is-chess');panel.hidden=true;controls.enabled=true;controls.minDistance=2;controls.minPolarAngle=Math.PI*.20;
    selection(null);syncPieces();onExit(reset);$('room-chess-trigger')?.focus({preventScroll:true});
  }
  $('chess-exit').addEventListener('click',()=>close());
  $('chess-book-toggle').addEventListener('click',()=>toggleBook());
  $('chess-prev').addEventListener('click',()=>{page=Math.max(0,page-1);showPage(true);});
  $('chess-next').addEventListener('click',()=>{page=Math.min(openings.length-1,page+1);showPage(true);});
  $('chess-apply').addEventListener('click',()=>{study.load(page);syncPieces();onFocus('chess');});
  for(const [id,fn] of [['chess-undo',()=>study.undo()],['chess-reset',()=>study.reset()],['chess-start',()=>study.start()],['chess-step-back',()=>study.step(-1)],['chess-step-next',()=>study.step(1)]]){
    $(id).addEventListener('click',()=>{fn();syncPieces();});
  }
  const trigger=$('room-chess-trigger');if(trigger){trigger.disabled=false;trigger.addEventListener('click',()=>open());}
  function at(event){
    const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
    const point=ray.ray.intersectPlane(plane,new THREE.Vector3());
    const hit=ray.intersectObjects(pieces.children,false)[0];
    return {point,square:hit?.object.userData.square|| (point&&pointSquare(point))};
  }
  function cancelDrag(){
    if(!drag)return;const previous=drag;drag=null;
    const moving=pieces.children.find(m=>m.userData.square===previous.square);if(moving)moving.position.copy(squarePosition(previous.square));
    try{canvas.releasePointerCapture(previous.id);}catch{}controls.enabled=true;changed(true);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(drag && e.pointerId!==drag.id)return;
    if(!active||e.button!==0)return;gesture={x:e.clientX,y:e.clientY,moved:false};
    if(study.game.isGameOver())return;
    const hit=at(e),p=hit.square&&study.game.get(hit.square);
    if(p?.color!==study.game.turn())return;
    animation++;for(const m of pieces.children)m.position.copy(squarePosition(m.userData.square));
    selection(hit.square);drag={id:e.pointerId,square:hit.square,x:e.clientX,y:e.clientY,moved:false};
    controls.enabled=false;canvas.setPointerCapture(e.pointerId);e.preventDefault();e.stopImmediatePropagation();
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(gesture)gesture.moved ||= Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>6;
    if(!drag||e.pointerId!==drag.id)return;e.stopImmediatePropagation();e.preventDefault();
    drag.moved ||= Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6;
    if(drag.moved){const {point}=at(e);const moving=pieces.children.find(m=>m.userData.square===drag.square);if(point&&moving){moving.position.copy(point);moving.position.y+=.09;changed();}}
  },true);
  canvas.addEventListener('pointerup',e=>{
    if(!drag||e.pointerId!==drag.id)return;e.stopImmediatePropagation();e.preventDefault();
    const {point}=at(e),to=point&&pointSquare(point),wasDragged=drag.moved;
    cancelDrag();blockClick=true;window.setTimeout(()=>{blockClick=false;},0);
    if(wasDragged&&to!==selected)moveTo(to);
  },true);
  canvas.addEventListener('pointercancel',()=>{cancelDrag();selection(null);},true);
  canvas.addEventListener('lostpointercapture',()=>cancelDrag(),true);
  canvas.addEventListener('click',e=>{
    if(!active||e.button!==0)return;
    if(blockClick||gesture?.moved){e.stopImmediatePropagation();return;}
    const {square}=at(e);if(square){e.stopImmediatePropagation();choose(square);}
  },true);
  document.addEventListener('keydown',e=>{
    if(active&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}
    else if(!active&&e.key==='7'&&root.contains(document.activeElement)&&!document.querySelector('[data-panel-name]:not([hidden])')){e.preventDefault();open();}
  },true);
  panel.addEventListener('keydown',e=>e.stopPropagation());
  window.addEventListener('blur',()=>cancelDrag());
  showPage();syncPieces();
  return {open,close,get active(){return active;},get dragging(){return Boolean(drag);},study};
}
