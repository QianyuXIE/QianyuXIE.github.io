import * as THREE from 'three';

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
