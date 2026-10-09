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
    if(!response.ok)throw Object.assign(new Error(body.error||'???????????'),{status:response.status});
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
    setStatus(loginStatus,'?????');
    try {
      const result=await api('/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:password.value})});
      sessionStorage.setItem(sessionKey,result.token);password.value='';setStatus(loginStatus,'');showCompose();
    } catch(error) { setStatus(loginStatus,error.status===401?'??????':error.message,'error'); }
    finally {button.disabled=false;}
  });

  root.querySelector('[data-publisher-logout]').addEventListener('click',()=>{
    sessionStorage.removeItem(sessionKey);files=[];renderPreviews();compose.reset();showLogin();
  });
  root.querySelector('[data-photo-picker]').addEventListener('click',()=>input.click());
  input.addEventListener('change',()=>{
    const incoming=Array.from(input.files||[]).filter(file=>file.type.startsWith('image/'));
    const available=Math.max(0,9-files.length);files.push(...incoming.slice(0,available));input.value='';
    if(incoming.length>available)setStatus(publishStatus,'???????? 9 ????','error');
    else setStatus(publishStatus,'');
    renderPreviews();
  });
  text.addEventListener('input',()=>{count.textContent=`${text.value.length} / 5000`;});
  function renderPreviews() {
    previews.replaceChildren();
    files.forEach((file,index)=>{
      const figure=document.createElement('div');figure.className='publisher-preview';
      const image=document.createElement('img');image.alt=`????? ${index+1}`;
      const url=URL.createObjectURL(file);image.src=url;image.onload=()=>URL.revokeObjectURL(url);
      const remove=document.createElement('button');remove.type='button';remove.setAttribute('aria-label',`??? ${index+1} ???`);remove.textContent='?';
      remove.addEventListener('click',()=>{files.splice(index,1);renderPreviews();});
      figure.append(image,remove);previews.append(figure);
    });
  }
  function decodeImage(file) {
    const loadWithImage=()=>new Promise((resolve,reject)=>{
      const image=new Image(),url=URL.createObjectURL(file);
      image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};
      image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error(`???? ${file.name}`));};image.src=url;
    });
    return typeof createImageBitmap==='function'?createImageBitmap(file).catch(loadWithImage):loadWithImage();
  }
  async function compress(file) {
    const image=await decodeImage(file),width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
    const scale=Math.min(1,2000/Math.max(width,height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const context=canvas.getContext('2d',{alpha:false});context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);image.close?.();
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('???????')),'image/jpeg',.86));
    if(blob.size>3*1024*1024)throw new Error(`${file.name} ?????? 3 MB??????`);
    return new File([blob],file.name.replace(/\.[^.]+$/, '')+'.jpg',{type:'image/jpeg'});
  }
  compose.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!text.value.trim()&&!files.length){setStatus(publishStatus,'??????????','error');return;}
    submit.disabled=true;progress.hidden=false;progress.value=4;setStatus(publishStatus,'???????');
    try {
      const form=new FormData();form.set('text',text.value.trim());form.set('title',compose.elements.title.value.trim());form.set('location',compose.elements.location.value.trim());
      for(let i=0;i<files.length;i++){form.append('photos',await compress(files[i]),`photo-${String(i+1).padStart(2,'0')}.jpg`);progress.value=10+Math.round((i+1)/Math.max(files.length,1)*45);}
      setStatus(publishStatus,'????????????');progress.value=62;
      const result=await api('/publish',{method:'POST',body:form});progress.value=100;
      compose.reset();files=[];renderPreviews();count.textContent='0 / 5000';
      const link=document.createElement('a');link.href=result.momentUrl;link.textContent='???? Moment';link.rel='noopener';
      publishStatus.replaceChildren(document.createTextNode('???????GitHub Pages ??????????? '),link);publishStatus.className='publisher-status is-success';
    } catch(error) {
      if(error.status===401){sessionStorage.removeItem(sessionKey);showLogin();setStatus(loginStatus,'??????????????','error');}
      else setStatus(publishStatus,error.message,'error');
      progress.value=0;
    } finally {submit.disabled=false;window.setTimeout(()=>{progress.hidden=true;},800);}
  });
})();
