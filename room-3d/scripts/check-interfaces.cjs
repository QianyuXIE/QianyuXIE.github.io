// Run with NODE_PATH pointing to the temporary QA installation (jsdom/liquidjs/yaml).
// This checks DOM behavior, not browser rendering or WebGL.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM, VirtualConsole } = require('jsdom');
const { Liquid } = require('liquidjs');
const YAML = require('yaml');
const root = path.resolve(__dirname, '../..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const engine = new Liquid({strictFilters:true,root:path.join(root,'_includes'),dynamicPartials:false});
engine.registerFilter('relative_url', v=>v);
const page = YAML.parse(read('room.html').split('---')[1]);
const markup = engine.parseAndRenderSync(read('_includes/room-experience.html'),{page});
const errors=[];
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError',e=>errors.push(e));
const dom = new JSDOM(markup,{runScripts:'outside-only',url:'https://qianyuxie.github.io/room/',pretendToBeVisual:true,virtualConsole});
const w=dom.window,d=w.document;
const $=s=>d.querySelector(s);
w.matchMedia=()=>({matches:true,addEventListener(){}});
w.HTMLElement.prototype.getClientRects=function(){return this.closest('[hidden]')?[]:[{width:300,height:200}];};
w.HTMLElement.prototype.scrollIntoView=function(){};
w.HTMLElement.prototype.scrollBy=function(){};
w.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},beginPath(){},moveTo(){},bezierCurveTo(){},stroke(){},lineTo(){}});
w.HTMLCanvasElement.prototype.setPointerCapture=function(){};
const tick=()=>new Promise(r=>setTimeout(r,10));
const dispatch=(name,detail)=>d.dispatchEvent(new w.CustomEvent('qianyu-room:'+name,{detail}));
async function open(name){dispatch('interaction',{name});await tick();assert.equal($(`[data-panel-name="${name}"]`).hidden,false);}
function close(){d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal($('#room-panel-layer').hidden,true);}
function command(value){$('#terminal-input').value=value;$('#terminal-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}
(async()=>{
  w.eval(read('js/room-experience.js'));
  assert.equal(d.querySelectorAll('[data-panel-name]').length,6);
  await open('cv');
  command('help');assert.match($('#terminal-output').textContent,/history/);
  command('echo <script>unsafe<\/script>');assert.equal($('#terminal-output').querySelector('script'),null);
  command('socials');assert($('#terminal-output a[href="mailto:225040249@link.cuhk.edu.cn"]'));
  command('history');assert.match($('#terminal-output').textContent,/echo <script>/);
  command('clear');assert.equal($('#terminal-output').textContent,'');close();
  let boardUpdates=0;d.addEventListener('qianyu-room:board-updated',()=>boardUpdates++);
  await open('research');$('#board-clear').click();assert.equal(boardUpdates,1);
  $('#board-erase').click();assert.equal($('#board-erase').getAttribute('aria-pressed'),'true');
  $('[data-board-color="#397597"]').click();assert.equal($('#board-erase').getAttribute('aria-pressed'),'false');close();
  await open('film');assert.equal(d.querySelectorAll('.film-frame').length,page.desk_photos.length);
  $('[data-film-album="1"]').click();assert([...d.querySelectorAll('.film-frame')].filter(el=>!el.hidden).every(el=>el.dataset.album==='1'));
  $('.film-frame:not([hidden]) .film-enlarge').click();assert($('.film-frame.is-expanded'));close();
  let record;d.addEventListener('qianyu-room:record-selected',e=>record=e.detail);
  await open('music');$('[data-record="1"]').click();$('#record-select').click();assert.equal($('#mini-title').textContent,'吴青峰');assert.equal(record.color,0xa38c60);assert.equal(record.spinning,true);
  await open('music');$('[data-record="0"]').click();close();$('#mini-spin').click();assert.equal(record.color,0xa38c60);assert.equal(record.spinning,false);
  await open('about');
  assert.equal(d.querySelectorAll('.cinema-card').length,page.desk_movies.length);
  let cinemaScroll;const cinema=$('#cinema-reel');cinema.scrollBy=options=>{cinemaScroll=options.left;};
  Object.defineProperty(cinema,'clientWidth',{value:600});Object.defineProperty(cinema,'scrollWidth',{value:2000});
  $('[data-cinema-step="1"]').click();assert(cinemaScroll>0);
  $('[data-cinema-step="-1"]').click();assert(cinemaScroll<0);
  cinema.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert(cinemaScroll>0);
  cinema.dispatchEvent(new w.WheelEvent('wheel',{deltaY:90,cancelable:true}));assert.equal(cinema.scrollLeft,90);
  close();await open('books');assert.equal(d.querySelectorAll('.reading-card').length,5);assert(d.querySelector('.reading-intro').textContent.includes('五本书'));close();
  await open('music');
  assert.equal(d.querySelectorAll('[data-record]').length,page.desk_playlist.length+2);
  for(let i=0;i<page.desk_playlist.length;i++){
    $('[data-record="'+(i+2)+'"]').click();
    assert.equal($('#record-title').textContent,page.desk_playlist[i]);
    assert.equal($('#record-artist').textContent,'苏打绿');
    assert(decodeURIComponent($('#record-listen').href).includes(page.desk_playlist[i]));
  }
  $('#record-select').click();assert.equal($('#mini-title').textContent,page.desk_playlist.at(-1));close();
  $('#room-lamp-toggle').click();assert.equal($('#room-lamp-toggle').getAttribute('aria-checked'),'true');
  $('#room-time-toggle').click();assert.equal($('#room-time-toggle').getAttribute('aria-checked'),'true');
  // A rapid open-close cannot leave a delayed dialog behind.
  dispatch('interaction',{name:'cv'});$('#room-reset').click();await tick();assert.equal($('#room-panel-layer').hidden,true);
  assert.equal(errors.length,0,errors.map(String).join('\n'));
  console.log('PASS: Liquid template; 6 dialogs; terminal commands/history/text safety; drawing tools; photo filters; record persistence; close/Escape; light switches; canceled transitions.');
  w.close();
})().catch(e=>{console.error(e);w.close();process.exitCode=1;});
