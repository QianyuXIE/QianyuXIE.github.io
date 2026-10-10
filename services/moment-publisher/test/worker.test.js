import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

const origin='https://qianyuxie.github.io';
const env={
  ALLOWED_ORIGIN:origin,
  GITHUB_OWNER:'QianyuXIE',
  GITHUB_REPO:'QianyuXIE.github.io',
  GITHUB_BRANCH:'main',
  PUBLISH_PASSWORD:'correct horse battery staple',
  SESSION_SECRET:'a-test-secret-that-is-long-enough-and-never-deployed',
  GITHUB_TOKEN:'test-token'
};

function request(path,{method='GET',token,body,originHeader=origin,headers={}}={}){
  const allHeaders=new Headers({Origin:originHeader,'X-Moment-Request':'1',...headers});
  if(token)allHeaders.set('Authorization',`Bearer ${token}`);
  return new Request(`https://publisher.example${path}`,{method,headers:allHeaders,body});
}

async function login(password=env.PUBLISH_PASSWORD){
  const response=await worker.fetch(request('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})}),env);
  return {response,body:await response.json()};
}

test('allows only the configured site origin and password',async()=>{
  const denied=await worker.fetch(request('/health',{originHeader:'https://attacker.example'}),env);
  assert.equal(denied.status,403);

  const wrong=await login('wrong password');
  assert.equal(wrong.response.status,401);
  assert.equal(wrong.body.error,'密码不正确。');

  const ok=await login();
  assert.equal(ok.response.status,200);
  assert.match(ok.body.token,/^\d+\.[^.]+\.[A-Za-z0-9_-]+$/);
  assert.equal(ok.response.headers.get('Access-Control-Allow-Origin'),origin);

  const session=await worker.fetch(request('/session',{token:ok.body.token}),env);
  assert.equal(session.status,200);
  assert.deepEqual(await session.json(),{ok:true});

  const tampered=await worker.fetch(request('/session',{token:`${ok.body.token}x`}),env);
  assert.equal(tampered.status,401);
});

test('publishes Markdown and photos in one Git commit',async t=>{
  const originalFetch=globalThis.fetch;
  const blobs=[];
  const trees=[];
  let blobNumber=0;
  globalThis.fetch=async(url,options={})=>{
    const parsed=new URL(url);
    assert.equal(options.headers.Authorization,'Bearer test-token');
    const path=parsed.pathname.replace('/repos/QianyuXIE/QianyuXIE.github.io','');
    if(path==='/git/blobs'&&options.method==='POST'){
      const payload=JSON.parse(options.body);blobs.push(payload);
      return Response.json({sha:`blob-${++blobNumber}`});
    }
    if(path==='/git/ref/heads/main')return Response.json({object:{sha:'parent-sha'}});
    if(path==='/git/commits/parent-sha')return Response.json({tree:{sha:'base-tree'}});
    if(path==='/git/trees'&&options.method==='POST'){trees.push(JSON.parse(options.body));return Response.json({sha:'new-tree'});}
    if(path==='/git/commits'&&options.method==='POST')return Response.json({sha:'new-commit'});
    if(path==='/git/refs/heads/main'&&options.method==='PATCH')return Response.json({object:{sha:'new-commit'}});
    return Response.json({message:`Unhandled test URL ${path}`},{status:500});
  };
  t.after(()=>{globalThis.fetch=originalFetch;});

  const {body:auth}=await login();
  const form=new FormData();
  form.set('text','今天的文字\n第二行');
  form.set('date','2025-03-08T09:07');
  form.set('title','生活: “一页”');
  form.set('location','深圳');
  form.append('photos',new File([new Uint8Array([0xff,0xd8,0xff,0xd9])],'one.jpg',{type:'image/jpeg'}));
  form.append('photos',new File([new Uint8Array([0xff,0xd8,1,2,0xff,0xd9])],'two.jpg',{type:'image/jpeg'}));
  const response=await worker.fetch(request('/publish',{method:'POST',token:auth.token,body:form}),env);
  const body=await response.json();

  assert.equal(response.status,200);
  assert.equal(body.commit,'new-commit');
  assert.match(body.momentUrl,/^https:\/\/qianyuxie\.github\.io\/moment\/#moment-2025-03-08-090700-/);
  assert.equal(blobs.length,3);
  const decoded=blobs.map(item=>Buffer.from(item.content,'base64'));
  assert.deepEqual([...decoded[0]],[0xff,0xd8,0xff,0xd9]);
  assert.deepEqual([...decoded[1]],[0xff,0xd8,1,2,0xff,0xd9]);
  const markdown=decoded[2].toString('utf8');
  assert.match(markdown,/title: "生活: “一页”"/);
  assert.match(markdown,/location: "深圳"/);
  assert.match(markdown,/date: 2025-03-08 09:07:00 \+0800/);
  assert.match(markdown,/images:\n  - \/img\/_Moment\/2025-03-08-090700-.+-01\.jpg\n  - \/img\/_Moment\/2025-03-08-090700-.+-02\.jpg/);
  assert.match(markdown,/---\n\n今天的文字\n第二行\n$/);
  assert.deepEqual(trees[0].tree.map(item=>item.path),[
    'img/_Moment/'+body.momentUrl.match(/moment-(2025-03-08-090700-[^/]+)/)[1]+'-01.jpg',
    'img/_Moment/'+body.momentUrl.match(/moment-(2025-03-08-090700-[^/]+)/)[1]+'-02.jpg',
    '_moments/'+body.momentUrl.match(/moment-(2025-03-08-090700-[^/]+)/)[1]+'.md'
  ]);
});

test('validates empty posts, file type and photo count before GitHub',async()=>{
  const {body:auth}=await login();
  const empty=new FormData();
  assert.equal((await worker.fetch(request('/publish',{method:'POST',token:auth.token,body:empty}),env)).status,400);

  const wrongType=new FormData();wrongType.append('photos',new File(['not jpeg'],'note.png',{type:'image/png'}));
  const wrongResponse=await worker.fetch(request('/publish',{method:'POST',token:auth.token,body:wrongType}),env);
  assert.equal(wrongResponse.status,400);
  assert.match((await wrongResponse.json()).error,/JPEG/);

  const tooMany=new FormData();
  for(let i=0;i<10;i++)tooMany.append('photos',new File(['x'],`${i}.jpg`,{type:'image/jpeg'}));
  const countResponse=await worker.fetch(request('/publish',{method:'POST',token:auth.token,body:tooMany}),env);
  assert.equal(countResponse.status,400);
  assert.match((await countResponse.json()).error,/9/);

  const invalidDate=new FormData();invalidDate.set('text','日期测试');invalidDate.set('date','2026-02-30T12:00');
  const dateResponse=await worker.fetch(request('/publish',{method:'POST',token:auth.token,body:invalidDate}),env);
  assert.equal(dateResponse.status,400);
  assert.match((await dateResponse.json()).error,/日期/);
});

test('temporarily throttles repeated wrong passwords from one address',async()=>{
  const headers={'CF-Connecting-IP':'203.0.113.44'};
  for(let attempt=0;attempt<5;attempt++){
    const response=await worker.fetch(request('/login',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({password:'wrong'})}),env);
    assert.equal(response.status,401);
  }
  const blocked=await worker.fetch(request('/login',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({password:env.PUBLISH_PASSWORD})}),env);
  assert.equal(blocked.status,429);
  assert.match((await blocked.json()).error,/十分钟/);
});
