(() => {
  const page=document.querySelector('.moments-page');
  if(!page) return;
  const dialog=page.querySelector('.moments-lightbox');
  if(!dialog || typeof dialog.showModal!=='function') return; // Links still open originals.
  const full=dialog.querySelector('[data-photo-full]'), counter=dialog.querySelector('[data-photo-count]');
  const caption=dialog.querySelector('[data-photo-caption]'), original=dialog.querySelector('[data-photo-original]');
  const error=dialog.querySelector('[data-photo-error]');
  const prev=dialog.querySelector('[data-photo-prev]'),next=dialog.querySelector('[data-photo-next]');
  const close=dialog.querySelector('[data-photo-close]');
  let photos=[],index=0,opener=null,overflow='',touch=null;
  function show(n) {
    index=Math.max(0,Math.min(n,photos.length-1));
    const link=photos[index],alt=link.querySelector('img').alt;
    error.hidden=true;full.hidden=false;full.alt=alt;full.src=link.href;
    original.href=link.href;caption.textContent=alt;counter.textContent=`${index+1} / ${photos.length}`;
    prev.disabled=index===0;next.disabled=index===photos.length-1;
  }
  page.addEventListener('click',event=>{
    const link=event.target.closest('[data-moment-photo]');
    if(!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();opener=link;
    photos=Array.from(link.closest('.moment-card').querySelectorAll('[data-moment-photo]'));
    show(photos.indexOf(link));overflow=document.body.style.overflow;document.body.style.overflow='hidden';
    dialog.showModal();close.focus();
  });
  close.addEventListener('click',()=>dialog.close());
  prev.addEventListener('click',()=>show(index-1));next.addEventListener('click',()=>show(index+1));
  dialog.addEventListener('click',event=>{if(event.target===dialog || event.target.classList.contains('moments-lightbox-stage'))dialog.close();});
  dialog.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'){event.preventDefault();show(index-1);}
    if(event.key==='ArrowRight'){event.preventDefault();show(index+1);}
    if(event.key==='Escape'){event.preventDefault();dialog.close();}
  });
  dialog.addEventListener('close',()=>{document.body.style.overflow=overflow;full.removeAttribute('src');opener?.focus();touch=null;});
  full.addEventListener('error',()=>{if(dialog.open){error.hidden=false;full.hidden=true;}});
  full.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')touch={x:event.clientX,y:event.clientY,id:event.pointerId};});
  full.addEventListener('pointerup',event=>{
    if(!touch || event.pointerId!==touch.id)return;
    const dx=event.clientX-touch.x,dy=event.clientY-touch.y;touch=null;
    if(Math.abs(dx)>50 && Math.abs(dx)>Math.abs(dy)*1.5)show(index+(dx<0?1:-1));
  });
  full.addEventListener('pointercancel',()=>{touch=null;});
})();
