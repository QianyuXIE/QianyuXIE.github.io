const encoder=new TextEncoder();
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const hex=bytes=>Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,'0')).join('');
const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const base64=bytes=>{const data=new Uint8Array(bytes);let result='';for(let i=0;i<data.length;i+=0x8000)result+=String.fromCharCode(...data.subarray(i,i+0x8000));return btoa(result);};
const safeEqual=(left,right)=>{if(left.length!==right.length)return false;let diff=0;for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);return diff===0;};
const loginFailures=new Map();
const loginWindow=10*60*1000;
async function sha256(value){return hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));}
async function signature(value,secret){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return base64url(await crypto.subtle.sign('HMAC',key,encoder.encode(value)));}
async function makeToken(secret){const expires=Math.floor(Date.now()/1000)+14400,nonce=crypto.randomUUID(),payload=`${expires}.${nonce}`;return `${payload}.${await signature(payload,secret)}`;}
async function validToken(token,secret){if(!token||!secret)return false;const parts=token.split('.');if(parts.length!==3||Number(parts[0])<Date.now()/1000)return false;return safeEqual(parts[2],await signature(`${parts[0]}.${parts[1]}`,secret));}
const authToken=request=>(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'');
const yamlString=value=>JSON.stringify(String(value).replace(/\r\n?/g,'\n'));
const dateParts=()=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts().filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
function makeMoment({text,title,location,paths,identity={}}){
  const now=identity.now||dateParts(),day=identity.day||`${now.year}-${now.month}-${now.day}`,clock=`${now.hour}${now.minute}${now.second}`,slug=identity.slug||`${day}-${clock}-${crypto.randomUUID().slice(0,6)}`;
  const front=['---',`date: ${day} ${now.hour}:${now.minute}:${now.second} +0800`];
  if(title)front.push(`title: ${yamlString(title)}`);if(location)front.push(`location: ${yamlString(location)}`);
  if(paths.length){front.push('images:');paths.forEach(path=>front.push(`  - ${path}`));}
  return {slug,day,now,markdown:`${front.join('\n')}\n---\n\n${text}\n`,path:`_moments/${slug}.md`};
}
function corsHeaders(origin){return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, X-Moment-Request','Access-Control-Max-Age':'86400','Vary':'Origin'};}
async function github(env,path,options={}){
  const response=await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}${path}`,{...options,headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${env.GITHUB_TOKEN}`,'User-Agent':'qianyu-moment-publisher','X-GitHub-Api-Version':'2022-11-28',...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(`GitHub ${response.status}: ${body.message||'request failed'}`);return body;
}
async function createBlob(env,bytes){return (await github(env,'/git/blobs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:base64(bytes),encoding:'base64'})})).sha;}
async function commitFiles(env,files,message){
  const branch=env.GITHUB_BRANCH||'main',encodedBranch=encodeURIComponent(branch);
  const blobs=await Promise.all(files.map(async file=>({...file,sha:await createBlob(env,file.bytes)})));
  for(let attempt=0;attempt<2;attempt++){
    const ref=await github(env,`/git/ref/heads/${encodedBranch}`),parent=ref.object.sha;
    const commit=await github(env,`/git/commits/${parent}`);
    const tree=await github(env,'/git/trees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:commit.tree.sha,tree:blobs.map(file=>({path:file.path,mode:'100644',type:'blob',sha:file.sha}))})});
    const created=await github(env,'/git/commits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,tree:tree.sha,parents:[parent]})});
    try {await github(env,`/git/refs/heads/${encodedBranch}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:created.sha,force:false})});return created;}
    catch(error){if(attempt===1||!error.message.includes('422'))throw error;}
  }
}
async function publish(request,env){
  const contentLength=Number(request.headers.get('Content-Length')||0);
  if(contentLength>28*1024*1024)return json({error:'本次上传内容过大。'},413);
  const form=await request.formData(),text=String(form.get('text')||'').replace(/\r\n?/g,'\n').trim(),title=String(form.get('title')||'').replace(/\r\n?/g,' ').trim(),location=String(form.get('location')||'').replace(/\r\n?/g,' ').trim();
  const photos=form.getAll('photos').filter(value=>value instanceof File);
  if(!text&&!photos.length)return json({error:'请写文字或选择照片。'},400);
  if(text.length>5000||title.length>80||location.length>80)return json({error:'文字超过长度限制。'},400);
  if(photos.length>9)return json({error:'每条动态最多 9 张照片。'},400);
  let total=0;for(const photo of photos){total+=photo.size;if(photo.type!=='image/jpeg'||photo.size>3*1024*1024)return json({error:'照片必须是压缩后的 JPEG，且每张不超过 3 MB。'},400);}
  if(total>24*1024*1024)return json({error:'照片总大小不能超过 24 MB。'},400);
  const provisional=makeMoment({text,title,location,paths:[]});
  const imagePaths=photos.map((_,index)=>`/img/moments/${provisional.day}/${provisional.slug}-${String(index+1).padStart(2,'0')}.jpg`);
  const moment=makeMoment({text,title,location,paths:imagePaths,identity:provisional});
  const files=[];for(let i=0;i<photos.length;i++)files.push({path:imagePaths[i].slice(1),bytes:await photos[i].arrayBuffer()});
  files.push({path:moment.path,bytes:encoder.encode(moment.markdown)});
  const commit=await commitFiles(env,files,`Publish Moment ${provisional.day}`);
  return json({ok:true,commit:commit.sha,momentUrl:`${env.ALLOWED_ORIGIN}/moment/#moment-${provisional.slug}`});
}
export default {async fetch(request,env){
  const origin=request.headers.get('Origin')||'';
  if(origin!==env.ALLOWED_ORIGIN)return json({error:'Origin not allowed.'},403);
  const headers=corsHeaders(origin);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const respond=async()=>{
    const url=new URL(request.url);
    if(request.headers.get('X-Moment-Request')!=='1')return json({error:'Invalid request.'},400);
    if(url.pathname==='/health'&&request.method==='GET')return json({ok:true});
    if(url.pathname==='/login'&&request.method==='POST'){
      if(!env.PUBLISH_PASSWORD||!env.SESSION_SECRET||env.SESSION_SECRET.length<32)return json({error:'发布服务尚未正确配置。'},503);
      const client=request.headers.get('CF-Connecting-IP')||'unknown',now=Date.now(),record=loginFailures.get(client);
      if(record&&record.until>now&&record.count>=5)return json({error:'尝试次数过多，请十分钟后再试。'},429);
      const {password=''}=await request.json().catch(()=>({}));
      if(!safeEqual(await sha256(String(password)),await sha256(env.PUBLISH_PASSWORD))){
        const current=record&&record.until>now?record:{count:0,until:now+loginWindow};
        current.count+=1;loginFailures.set(client,current);
        return json({error:'密码不正确。'},401);
      }
      loginFailures.delete(client);
      return json({ok:true,token:await makeToken(env.SESSION_SECRET),expiresIn:14400});
    }
    if(!await validToken(authToken(request),env.SESSION_SECRET))return json({error:'登录已过期。'},401);
    if(url.pathname==='/session'&&request.method==='GET')return json({ok:true});
    if(url.pathname==='/publish'&&request.method==='POST')return publish(request,env);
    return json({error:'Not found.'},404);
  };
  try {const response=await respond();Object.entries(headers).forEach(([key,value])=>response.headers.set(key,value));return response;}
  catch(error){console.error(error);const response=json({error:'发布服务暂时不可用。'},500);Object.entries(headers).forEach(([key,value])=>response.headers.set(key,value));return response;}
}};
