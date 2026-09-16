import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export function createFocus(renderer,scene,camera) {
  const composer=new EffectComposer(renderer);
  const bokeh=new BokehPass(scene,camera,{focus:5,aperture:.00008,maxblur:.003});
  composer.addPass(new RenderPass(scene,camera));composer.addPass(bokeh);composer.addPass(new OutputPass());
  return {
    render(target){bokeh.uniforms.focus.value=camera.position.distanceTo(target);composer.render();},
    resize(width,height){composer.setSize(width,height);}
  };
}
