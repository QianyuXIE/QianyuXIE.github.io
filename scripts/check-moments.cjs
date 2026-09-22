// DOM/Liquid regression checks; not a substitute for browser visual QA.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {Liquid}=require('liquidjs'),{JSDOM}=require('jsdom'),YAML=require('yaml');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const liquid=new Liquid({strictFilters:true});
liquid.registerFilter('relative_url',v=>'/test'+v);
liquid.registerFilter('date_to_xmlschema',v=>new Date(v).toISOString());
liquid.registerFilter('markdownify',v=>`<p>${v}</p>`);
const template=read('moment.html').replace(/^---[\s\S]*?---\s*/, '');
const make=(n)=>({slug:'test-'+n,date:'2026-09-21',content:'正文',images:Array.from({length:n},(_,i)=>'/img/test-'+i+'.jpg')});
function render(moments){return liquid.parseAndRenderSync(template,{site:{moments,posts:[{title:'旧文章',url:'/old/',date:'2023-05-25'}]}});}
for(let n=0;n<=10;n++) {
  const dom=new JSDOM(render([make(n)]));
  assert.equal(dom.window.document.querySelectorAll('[data-moment-photo]').length,Math.min(n,9));
  if(n)assert(dom.window.document.querySelector('.moment-grid--'+Math.min(n,9)));
  assert(dom.window.document.querySelector('a[href="/test/old/"]'));
  dom.window.close();
}
assert(!render([{...make(1),published:false}]).includes('moment-card'));
assert(render([]).includes('这里还没有动态'));
assert(render([{...make(1),images:[{src:'https://example.com/full.jpg',thumb:'/small.jpg',alt:'说明'}]}]).includes('href="https://example.com/full.jpg"'));
const dom=new JSDOM('<main class="moments-page">'+render([{...make(9),date:'2026-09-22'},make(1)])+'</main>',{url:'https://example.org',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,d=w.document,dialog=d.querySelector('dialog');
dialog.showModal=()=>dialog.setAttribute('open','');
dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new w.Event('close'));};
w.eval(read('js/moments.js'));
const photos=d.querySelectorAll('[data-moment-photo]'),full=d.querySelector('[data-photo-full]');
photos[0].click();assert(dialog.open);assert.equal(d.querySelector('[data-photo-count]').textContent,'1 / 9');
assert.equal(d.body.style.overflow,'hidden');
d.querySelector('[data-photo-next]').click();assert(full.src.endsWith('test-1.jpg'));
dialog.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert(full.src.endsWith('test-2.jpg'));
full.dispatchEvent(new w.Event('error'));assert.equal(d.querySelector('[data-photo-error]').hidden,false);
dialog.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!dialog.open);
assert.equal(d.activeElement,photos[0]);assert.equal(d.body.style.overflow,'');
photos[9].click();assert.equal(d.querySelector('[data-photo-count]').textContent,'1 / 1');
assert(d.querySelector('[data-photo-next]').disabled && d.querySelector('[data-photo-prev]').disabled);
d.querySelector('[data-photo-close]').click();
const sample=YAML.parse(read('_moments/2026-09-21-example.md').split('---')[1]);
for(const photo of sample.images)assert(fs.existsSync(path.join(root,photo)),'Sample asset exists: '+photo);
assert.equal(YAML.parse(read('_config.yml')).collections.moments.output,false);
dom.window.close();
console.log('PASS: 0–9 photos/cap, drafts, empty state, local/external URLs, article links, dialog navigation, errors, Escape/focus/scroll restoration and sample assets.');
