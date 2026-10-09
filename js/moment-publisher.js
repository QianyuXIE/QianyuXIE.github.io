(() => {
  const root=document.querySelector('.moment-publisher');
  if(!root) return;
  const endpoint=(root.dataset.publisherEndpoint||'').replace(/\/$/,'');
  const setup=root.querySelector('[data-publisher-setup]');
  const login=root.querySelector('[data-publisher-login]');
  const compose=root.querySelector('[data-publisher-compose]');
  const password=login.querySelector('[name="password"]');
  const loginStatus=root.querySelector('[data-login-status]');
  const publishStatus=root.querySelector('[data-publish-status]');
  const text=root.querySelector('[name="text"]');
  const input=root.querySelector('[name="photos"]');
  const previews=root.querySelector('[data-photo-previews]');
  const count=root.querySelector('[data-compose-count]');
  const submit=root.querySelector('[data-publish-submit]');
  const progress=root.querySelector('[data-publish-progress]');
  const sessionKey='qianyu-moment-session';
  let files=[];

  const setStatus=(element,message,type='')=>{
    element.textContent=message;
    element.className=`publisher-status${type?` is-${type}`:''}`;
  };
  const getToken=()=>sessionStorage.getItem(sessionKey)||'';
  const showCompose=()=>{login.hidden=true;compose.hidden=false;text.focus();};
  const showLogin=()=>{compose.hidden=true;login.hidden=false;password.focus();};
  async function api(path,options={}) {
    const headers=new Headers(options.headers||{});
    headers.set('X-Moment-Request','1');
    const token=getToken();if(token)headers.set('Authorization',`Bearer ${token}`);
    const response=await fetch(endpoint+path,{...options,headers,mode:'cors',cache:'no-store'});
    let body={};try{body=await response.json();}catch{}
    if(!response.ok)throw Object.assign(new Error(body.error||'请求失败，请稍后重试。'),{status:response.status});
    return body;
  }
  if(!endpoint) {
    setup.hidden=false;login.hidden=true;
    return;
  }

  if(getToken()) api('/session').then(showCompose).catch(()=>{sessionStorage.removeItem(sessionKey);showLogin();});
  else showLogin();

  login.addEventListener('submit',async event=>{
    event.preventDefault();const button=login.querySelector('button');button.disabled=true;
    setStatus(loginStatus,'正在验证…');
    try {
      const result=await api('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:password.value})});
      sessionStorage.setItem(sessionKey,result.token);password.value='';setStatus(loginStatus,'');showCompose();
    } catch(error) { setStatus(loginStatus,error.status===401?'密码不正确。':error.message,'error'); }
    finally {button.disabled=false;}
  });

  root.querySelector('[data-publisher-logout]').addEventListener('click',()=>{
    sessionStorage.removeItem(sessionKey);files=[];renderPreviews();compose.reset();showLogin();
  });
  root.querySelector('[data-photo-picker]').addEventListener('click',()=>input.click());
  input.addEventListener('change',()=>{
    const incoming=Array.from(input.files||[]).filter(file=>file.type.startsWith('image/'));
    const available=Math.max(0,9-files.length);files.push(...incoming.slice(0,available));input.value='';
    if(incoming.length>available)setStatus(publishStatus,'每条动态最多选择 9 张照片。','error');
    else setStatus(publishStatus,'');
    renderPreviews();
  });
  text.addEventListener('input',()=>{count.textContent=`${text.value.length} / 5000`;});
  function renderPreviews() {
    previews.replaceChildren();
    files.forEach((file,index)=>{
      const figure=document.createElement('div');figure.className='publisher-preview';
      const image=document.createElement('img');image.alt=`待发布照片 ${index+1}`;
      const url=URL.createObjectURL(file);image.src=url;image.onload=()=>URL.revokeObjectURL(url);
      const remove=document.createElement('button');remove.type='button';remove.setAttribute('aria-label',`移除第 ${index+1} 张照片`);remove.textContent='×';
      remove.addEventListener('click',()=>{files.splice(index,1);renderPreviews();});
      figure.append(image,remove);previews.append(figure);
    });
  }
  function decodeImage(file) {
    const loadWithImage=()=>new Promise((resolve,reject)=>{
      const image=new Image(),url=URL.createObjectURL(file);
      image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};
      image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error(`无法读取 ${file.name}`));};image.src=url;
    });
    return typeof createImageBitmap==='function'?createImageBitmap(file).catch(loadWithImage):loadWithImage();
  }
  async function compress(file) {
    const image=await decodeImage(file),width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
    const scale=Math.min(1,2000/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);image.close?.();
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('照片压缩失败。')),'image/jpeg',.86));
    if(blob.size>3*1024*1024)throw new Error(`${file.name} 压缩后仍超过 3 MB，请先裁剪。`);
    return new File([blob],file.name.replace(/\.[^.]+$/, '')+'.jpg',{type:'image/jpeg'});
  }
  compose.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!text.value.trim()&&!files.length){setStatus(publishStatus,'请写文字或选择照片。','error');return;}
    submit.disabled=true;progress.hidden=false;progress.value=4;setStatus(publishStatus,'正在处理照片…');
    try {
      const form=new FormData();form.set('text',text.value.trim());form.set('title',compose.elements.title.value.trim());form.set('location',compose.elements.location.value.trim());
      for(let i=0;i<files.length;i++){form.append('photos',await compress(files[i]),`photo-${String(i+1).padStart(2,'0')}.jpg`);progress.value=10+Math.round((i+1)/Math.max(files.length,1)*45);}
      setStatus(publishStatus,'正在安全上传并创建动态…');progress.value=62;
      const result=await api('/publish',{method:'POST',body:form});progress.value=100;
      compose.reset();files=[];renderPreviews();count.textContent='0 / 5000';
      const link=document.createElement('a');link.href=result.momentUrl;link.textContent='稍后查看 Moment';link.rel='noopener';
      publishStatus.replaceChildren(document.createTextNode('发布提交成功，GitHub Pages 通常需要约一分钟更新。 '),link);publishStatus.className='publisher-status is-success';
    } catch(error) {
      if(error.status===401){sessionStorage.removeItem(sessionKey);showLogin();setStatus(loginStatus,'登录已过期，请重新输入密码。','error');}
      else setStatus(publishStatus,error.message,'error');
      progress.value=0;
    } finally {submit.disabled=false;window.setTimeout(()=>{progress.hidden=true;},800);}
  });
})();
