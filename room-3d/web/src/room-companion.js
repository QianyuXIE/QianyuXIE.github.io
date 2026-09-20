import * as THREE from 'three';

// A small articulated, stylized seal-point ragdoll. All geometry is local;
// the owner's reference photographs are not uploaded to the public website.
export function createRoomCompanion(scene) {
  const root = new THREE.Group(); root.name = 'ragdoll_corner'; scene.add(root);
  const material = (color, roughness = .9) => new THREE.MeshStandardMaterial({color, roughness});
  const cream = material(0xe9e2d7), ruff = material(0xf5eee4);
  const seal = material(0x433a37), mask = material(0x64534a);
  const blue = material(0x6aafdf, .3), ink = material(0x181d24), pink = material(0x9d7775);
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  function ellipsoid(parent, mat, position, scale) {
    const mesh = new THREE.Mesh(sphere, mat);
    mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const cat = new THREE.Group(); cat.name = 'family_ragdoll'; root.add(cat);
  const torso = new THREE.Group(); cat.add(torso);
  ellipsoid(torso, cream, [0,.49,0], [.29,.31,.48]);
  ellipsoid(torso, ruff, [0,.58,.29], [.32,.33,.30]);
  // Scalloped neck silhouette suggests long fur without transparent fur cards.
  for(let i=0;i<9;i++) {
    const a=i/9*Math.PI*2;
    ellipsoid(torso, ruff, [Math.cos(a)*.235,.58+Math.sin(a)*.22,.33], [.105,.13,.15]);
  }
  const head = new THREE.Group(); head.position.set(0,.79,.39); torso.add(head);
  ellipsoid(head, cream, [0,0,0], [.255,.24,.24]);
  ellipsoid(head, mask, [0,-.025,.105], [.224,.183,.16]);
  ellipsoid(head, seal, [0,-.04,.18], [.153,.135,.102]);
  for(const side of [-1,1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(.13,.29,3),seal);
    ear.position.set(side*.17,.23,-.01); ear.rotation.z=-side*.23; ear.rotation.y=Math.PI;
    head.add(ear);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(.074,.18,3),pink);
    inner.position.set(side*.17,.235,.042); inner.rotation.copy(ear.rotation); head.add(inner);
    ellipsoid(head, mask, [side*.077,-.112,.222], [.083,.058,.045]);
    for(let i=0;i<3;i++) {
      const line = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(side*.075,-.11,.255),new THREE.Vector3(side*.33,-.07-i*.045,.24)
      ]);
      head.add(new THREE.Line(line,new THREE.LineBasicMaterial({color:0xd6cec5,transparent:true,opacity:.7})));
    }
  }
  const eyes=[];
  for(const side of [-1,1]) {
    const eye = new THREE.Group(); eye.position.set(side*.115,.015,.226); head.add(eye); eyes.push(eye);
    ellipsoid(eye,blue,[0,0,0],[.066,.046,.025]);
    ellipsoid(eye,ink,[0,0,.023],[.018,.035,.009]);
    ellipsoid(eye,ruff,[-.018,.015,.03],[.009,.01,.004]);
  }
  ellipsoid(head,ink,[0,-.085,.274],[.031,.022,.014]);
  const legs=[];
  for(const z of [-.28,.29]) for(const x of [-.19,.19]) {
    const leg = new THREE.Group(); leg.position.set(x,.39,z); cat.add(leg); legs.push(leg);
    ellipsoid(leg, z<0?cream:mask,[0,-.13,0],[.102,.20,.11]);
    ellipsoid(leg,seal,[0,-.28,.028],[.105,.095,.14]);
    ellipsoid(leg,ruff,[0,-.315,.067],[.099,.052,.106]);
  }
  const tail = new THREE.Group(); tail.position.set(0,.49,-.4); cat.add(tail);
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,0,0),new THREE.Vector3(.12,.12,-.22),
    new THREE.Vector3(.19,.37,-.47),new THREE.Vector3(.08,.52,-.62)
  ]);
  tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve,20,.104,8,false),seal));
  ellipsoid(tail,seal,[.08,.52,-.62],[.106,.104,.106]);
  // Soft contact shadow follows the pet without rebuilding the room shadow map.
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1.1,1.5), new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv; void main(){float a=(1.0-smoothstep(0.06,0.5,length(vUv-0.5)))*0.22;gl_FragColor=vec4(0.12,0.11,0.10,a);}'
  }));
  contact.rotation.x=-Math.PI/2; contact.position.y=.005; root.add(contact);
  const ceramic=material(0xa9b8b3,.35);
  const bowl=new THREE.Group(); bowl.position.set(-3.8,.01,3.7); root.add(bowl); bowl.name='cat_water_bowl';
  const bowlWall=new THREE.Mesh(new THREE.TorusGeometry(.24,.052,10,32),ceramic);
  bowlWall.rotation.x=Math.PI/2;bowlWall.position.y=.15;bowl.add(bowlWall);
  const bowlBase=new THREE.Mesh(new THREE.CylinderGeometry(.25,.19,.12,32),ceramic);
  bowlBase.position.y=.07;bowl.add(bowlBase);
  const water=new THREE.Mesh(new THREE.CircleGeometry(.20,32),material(0x8bb6bd,.18));
  water.rotation.x=-Math.PI/2;water.position.y=.135;bowl.add(water);
  const ripple=new THREE.Mesh(new THREE.RingGeometry(.10,.107,32),new THREE.MeshBasicMaterial({color:0xe3f1ef,transparent:true,opacity:.4,side:THREE.DoubleSide}));
  ripple.rotation.x=-Math.PI/2;ripple.position.y=.138;bowl.add(ripple);
  const bed=ellipsoid(root,material(0xb8aaa0),[-1,.045,5.4],[.8,.065,.65]);bed.name='cat_nap_mat';
  const ball=ellipsoid(root,material(0xad7673),[2.75,.12,4.6],[.12,.12,.12]);ball.name='cat_toy_ball';
  // A clear route in front of the furniture, not a random walk through its legs.
  const routine=[
    {kind:'sleep',duration:10,x:-1,z:5.4},
    {kind:'walk',duration:5,x:-2.5,z:5.1},
    {kind:'walk',duration:4,x:-3.8,z:4.32},
    {kind:'drink',duration:9,x:-3.8,z:4.32},
    {kind:'walk',duration:5,x:-2,z:5.2},
    {kind:'walk',duration:9,x:2.65,z:5.22},
    {kind:'play',duration:12,x:2.65,z:5.22},
    {kind:'walk',duration:8,x:-1,z:5.4}
  ];
  let index=0, elapsed=0, clock=0, start=new THREE.Vector3(-1,0,5.4);
  cat.position.copy(start);
  function update(dt) {
    dt=Math.max(0,Math.min(dt,.25)); elapsed+=dt;clock+=dt;
    if(elapsed>=routine[index].duration) {
      elapsed-=routine[index].duration;start.copy(cat.position);index=(index+1)%routine.length;
    }
    const state=routine[index], walking=state.kind==='walk', sleeping=state.kind==='sleep';
    const p=Math.min(elapsed/state.duration,1);
    if(walking) {
      cat.position.set(THREE.MathUtils.lerp(start.x,state.x,p),0,THREE.MathUtils.lerp(start.z,state.z,p));
      cat.rotation.y=Math.atan2(state.x-start.x,state.z-start.z);
    } else cat.rotation.y=state.kind==='sleep'?.6:Math.PI;
    torso.position.y=sleeping?-.20:state.kind==='drink'?-.1:Math.sin(clock*2)*.007;
    torso.rotation.x=state.kind==='drink'?.18:0;
    torso.scale.y=sleeping?.76+Math.sin(clock*1.8)*.015:1;
    head.rotation.x=sleeping?.18:state.kind==='drink'?.65+Math.sin(clock*9)*.045:state.kind==='play'?.25:0;
    head.rotation.z=sleeping?-.2:Math.sin(clock*.8)*.035;
    eyes.forEach(eye=>{eye.scale.y=sleeping?.06:(Math.sin(clock*1.3)>.996?.12:1);});
    legs.forEach((leg,i)=>{
      leg.rotation.x=walking?Math.sin(clock*8+(i===0||i===3?0:Math.PI))*.42:sleeping?-1.15:0;
      leg.position.y=sleeping?.17:.39;
    });
    if(state.kind==='play') {
      legs[2].rotation.x=-.65-Math.max(0,Math.sin(clock*4))*.6;
      ball.position.x=2.75+Math.sin(clock*2)*.23;ball.position.z=4.6+Math.sin(clock*4)*.1;
    }
    tail.rotation.y=sleeping?1.3:Math.sin(clock*1.5)*.25;
    ripple.visible=state.kind==='drink';ripple.scale.setScalar(.6+(clock*1.5%1)*1.1);
    contact.position.x=cat.position.x;contact.position.z=cat.position.z;contact.rotation.z=-cat.rotation.y;
    return state.kind;
  }
  update(0);
  return {root,cat,update,get state(){return routine[index].kind;}};
}

export function createWallNote(scene, document) {
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=704;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f8f6ef';ctx.fillRect(0,0,768,704);
  ctx.fillStyle='#282725';ctx.textAlign='center';
  ctx.font='78px KaiTi, STKaiti, "Kaiti SC", serif';
  ctx.fillText('甜的那顆，',384,275);ctx.fillText('可以給我嗎？',384,400);
  ctx.strokeStyle='#282725';ctx.lineWidth=7;ctx.lineCap='round';
  for(const x of [527,594]) {ctx.beginPath();ctx.arc(x,501,14,Math.PI,Math.PI*2);ctx.stroke();}
  ctx.beginPath();ctx.ellipse(560,539,46,28,0,0,Math.PI);ctx.closePath();ctx.stroke();
  for(const x of [539,560,581]) {ctx.beginPath();ctx.moveTo(x,539);ctx.lineTo(x,560);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(638,492);ctx.lineTo(638,514);ctx.moveTo(627,503);ctx.lineTo(649,503);ctx.stroke();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const geometry=new THREE.PlaneGeometry(1.30,1.19,12,12);
  const position=geometry.attributes.position;
  for(let i=0;i<position.count;i++) {
    const bottom=Math.max(0,-position.getY(i));
    position.setZ(i,.08*bottom*bottom+.015*Math.sin(position.getX(i)*4));
  }
  geometry.computeVertexNormals();
  const paper=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:texture,roughness:.97,side:THREE.DoubleSide}));
  paper.name='sweet_handwritten_note';paper.position.set(.02,4.6,-3.35);paper.rotation.z=-.055;
  paper.castShadow=true;paper.receiveShadow=true;scene.add(paper);
  const tapeMaterial=new THREE.MeshStandardMaterial({color:0xd7c8a7,transparent:true,opacity:.66,roughness:1,side:THREE.DoubleSide,depthWrite:false});
  for(const x of [-.38,.38]) {
    const tape=new THREE.Mesh(new THREE.PlaneGeometry(.32,.13),tapeMaterial);
    tape.position.set(x,.56,.026);tape.rotation.z=x*.25;paper.add(tape);
  }
  return paper;
}
