(function () {
  "use strict";
  const root = document.getElementById("room-experience");
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const all = (s) => Array.from(root.querySelectorAll(s));
  const layer = $("#room-panel-layer");
  const viewport = $("#room-viewport");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent("qianyu-room:" + name, { detail }));
  let active = null, opener = null, timer = null, lamp = false, night = false;
  root.classList.add("is-entered");
  document.body.classList.add("room-body-locked");

  function focusables() {
    return active ? Array.from(active.querySelectorAll("button, a[href], input, [tabindex]")).filter(el => !el.disabled && el.getClientRects().length) : [];
  }
  function loadImages(container) {
    container.querySelectorAll("img[data-src]").forEach(img => {
      if (img.closest("[hidden]")) return;
      img.src = img.dataset.src;
      img.removeAttribute("data-src");
      img.addEventListener("error", () => {
        img.alt = "照片暂时无法加载";
        img.classList.add("has-error");
      }, { once: true });
    });
  }
  function open(name, source) {
    name = ({ photos:"film", writing:"research" })[name] || name;
    if (name === "paper") { window.location.assign("/"); return; }
    if (name === "chair" || name === "guitar") return;
    const target = $('[data-panel-name="' + name + '"]');
    if (!target) return;
    clearTimeout(timer);
    opener = source || document.activeElement;
    // Lock orbiting immediately; the transition owns the camera until close.
    emit("panel-changed", { open:true, name });
    timer = setTimeout(() => {
      all("[data-panel-name]").forEach(el => { el.hidden = el !== target; });
      active = target;
      layer.hidden = false;
      loadImages(target);
      if (name === "cv") $("#terminal-input").focus();
      else (focusables()[0] || target).focus();
    }, reduced.matches ? 0 : 570);
  }
  function close() {
    clearTimeout(timer);
    layer.hidden = true;
    all("[data-panel-name]").forEach(el => { el.hidden = true; });
    active = null;
    emit("panel-changed", { open:false });
    emit("camera-reset");
    if (opener && opener.isConnected && opener.getClientRects().length) opener.focus();
    else (document.querySelector(".room-webgl canvas") || viewport).focus();
  }
  all("[data-room-panel-close]").forEach(el => el.addEventListener("click", close));
  all("[data-open]").forEach(el => el.addEventListener("click", () => {
    emit("focus-request", { name:el.dataset.open === "film" ? "photos" : el.dataset.open });
    open(el.dataset.open, el);
  }));
  document.addEventListener("qianyu-room:interaction", e => open(e.detail.name));
  function toggleLamp() {
    lamp = !lamp;
    root.classList.toggle("is-lamp-on", lamp);
    $("#room-lamp-toggle").setAttribute("aria-checked", String(lamp));
    emit("lamp-changed", { on:lamp });
  }
  function toggleNight() {
    night = !night;
    root.classList.toggle("is-night", night);
    $("#room-time-toggle").setAttribute("aria-checked", String(night));
    emit("time-changed", { night });
  }
  $("#room-lamp-toggle").addEventListener("click", toggleLamp);
  $("#room-time-toggle").addEventListener("click", toggleNight);
  $("#room-reset").addEventListener("click", close);
  document.addEventListener("qianyu-room:lamp-toggle", toggleLamp);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { if (active || !layer.hidden) { e.preventDefault(); close(); } return; }
    if (active) {
      if (e.key === "Tab") {
        const list = focusables(), first = list[0], last = list[list.length-1];
        if (!list.length) { e.preventDefault(); return; }
        if (!active.contains(document.activeElement) || (!e.shiftKey && document.activeElement === last)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      }
      return;
    }
    if (!root.contains(document.activeElement)) return;
    const map = {1:"cv",2:"research",3:"photos",4:"music",5:"about",6:"books"};
    if (map[e.key]) { e.preventDefault(); emit("focus-request", {name:map[e.key]}); open(map[e.key]); }
    else if (e.key.toLowerCase() === "l") toggleLamp();
    else if (e.key.toLowerCase() === "n") toggleNight();
    else if (/^Arrow/.test(e.key) || ["+","=","-","_","0"].includes(e.key)) {
      e.preventDefault(); emit("camera-key", {key:e.key,fast:e.shiftKey});
    }
  });

  // One fixed-resolution canvas is shared with Three.js; resize never erases it.
  const board = $("#room-whiteboard-canvas");
  const ctx = board.getContext("2d");
  let drawing = false, ink = "#252525", erase = false;
  function cleanBoard() { ctx.fillStyle="#f3f2ee"; ctx.fillRect(0,0,board.width,board.height); }
  function syncBoard() { emit("board-updated", {canvas:board}); }
  cleanBoard();
  ctx.strokeStyle="#333"; ctx.lineWidth=2.4; ctx.lineCap="round";
  [160,295].forEach(x => { ctx.beginPath(); ctx.moveTo(x,260); ctx.bezierCurveTo(x+42,180,x+57,180,x+108,255); ctx.stroke(); });
  const point = e => { const r=board.getBoundingClientRect(); return [(e.clientX-r.left)*board.width/r.width,(e.clientY-r.top)*board.height/r.height]; };
  board.addEventListener("pointerdown",e => {
    if(e.button!==0) return;
    e.preventDefault(); drawing=true; board.setPointerCapture(e.pointerId);
    const p=point(e); ctx.beginPath(); ctx.moveTo(...p);
    ctx.strokeStyle=erase?"#f3f2ee":ink; ctx.lineWidth=erase?28:3; ctx.lineTo(p[0]+.1,p[1]+.1); ctx.stroke();
  });
  board.addEventListener("pointermove",e => { if(!drawing)return; ctx.lineTo(...point(e)); ctx.stroke(); });
  function endDraw(){ if(!drawing)return; drawing=false; syncBoard(); }
  board.addEventListener("pointerup",endDraw);
  board.addEventListener("pointercancel",endDraw);
  board.addEventListener("lostpointercapture",endDraw);
  all("[data-board-color]").forEach(b => b.addEventListener("click",() => {
    ink=b.dataset.boardColor; erase=false; $("#board-erase").setAttribute("aria-pressed","false");
    all("[data-board-color]").forEach(c=>c.setAttribute("aria-pressed",String(c===b)));
  }));
  $("#board-erase").addEventListener("click",() => {
    erase=!erase; $("#board-erase").setAttribute("aria-pressed",String(erase));
    all("[data-board-color]").forEach(c=>c.setAttribute("aria-pressed",String(!erase&&c.dataset.boardColor===ink)));
  });
  $("#board-clear").addEventListener("click",()=>{cleanBoard();syncBoard();});
  document.addEventListener("qianyu-room:ready",syncBoard);

  // Albums use the existing personal photos, never another person's archive.
  const reel=$("#film-reel");
  all("[data-film-album]").forEach(b=>b.addEventListener("click",()=>{
    all("[data-film-album]").forEach(c=>c.setAttribute("aria-pressed",String(c===b)));
    all(".film-frame").forEach(f=>{f.hidden=b.dataset.filmAlbum!=="all"&&f.dataset.album!==b.dataset.filmAlbum;});
    reel.scrollLeft=0; loadImages(reel);
  }));
  all(".film-enlarge").forEach(b=>b.addEventListener("click",()=>{
    b.closest(".film-frame").classList.toggle("is-expanded");
    b.setAttribute("aria-pressed",String(b.closest(".film-frame").classList.contains("is-expanded")));
  }));
  reel.addEventListener("wheel",e=>{
    if(Math.abs(e.deltaY)>Math.abs(e.deltaX)&&reel.scrollWidth>reel.clientWidth){
      e.preventDefault(); reel.scrollLeft+=e.deltaY;
    }
  },{passive:false});
  reel.addEventListener("keydown",e=>{
    if(e.key==="ArrowRight"||e.key==="ArrowLeft"){e.preventDefault();reel.scrollBy({left:(e.key==="ArrowRight"?1:-1)*reel.clientWidth*.7,behavior:reduced.matches?"instant":"smooth"});}
  });

  const records=all('[data-record]').map(b=>({name:b.dataset.title,artist:b.dataset.artist,color:Number(b.dataset.color)}));
  let selectedRecord=0, playingRecord=0, spinning=false;
  all("[data-record]").forEach(b=>b.addEventListener("click",()=>{
    selectedRecord=Number(b.dataset.record);
    all("[data-record]").forEach(c=>c.setAttribute("aria-pressed",String(c===b)));
    $("#record-title").textContent=records[selectedRecord].name;
    $("#record-artist").textContent=records[selectedRecord].artist;
    $("#record-listen").href="https://www.youtube.com/results?search_query="+encodeURIComponent(records[selectedRecord].artist+' '+records[selectedRecord].name+' official');
  }));
  function setSpin(value){
    spinning=value;
    $("#mini-spin").textContent=spinning?"Ⅱ":"▶";
    $("#mini-spin").setAttribute("aria-pressed",String(spinning));
    $("#mini-spin").setAttribute("aria-label",spinning?"暂停唱片旋转":"旋转唱片");
    emit("record-selected",{color:records[playingRecord].color,spinning});
  }
  $("#record-select").addEventListener("click",()=>{
    playingRecord=selectedRecord;
    $("#studio-mini").hidden=false; $("#mini-title").textContent=records[selectedRecord].name;
    close();
    emit("focus-request",{name:"music"});
    setSpin(true);
  });
  $("#mini-spin").addEventListener("click",()=>setSpin(!spinning));

  // Real command handling with text nodes: typed input never becomes HTML.
  const output=$("#terminal-output"), input=$("#terminal-input"), history=[];
  let historyIndex=0;
  function print(text,className){
    const p=document.createElement("p"); p.className=className||"";p.textContent=text;output.appendChild(p);
  }
  function link(text,url){
    const p=document.createElement("p"),a=document.createElement("a");a.textContent=text;a.href=url;p.appendChild(a);output.appendChild(p);
  }
  function welcome(){
    print("visitor@qianyu:~$ welcome","command-line");
    const logo=document.createElement("pre");logo.className="terminal-logo";
    logo.textContent="  ____  _                         \n / __ \\(_)___ _____  __  ____  __  \n/ / / / / __ `/ __ \\/ / / / / / /  \n/ /_/ / / /_/ / / / / /_/ / /_/ /   \n\\___\\_/_/\\__,_/_/ /_/\\__, /\\__,_/    \n                   /____/          ";
    output.appendChild(logo);
    print("Welcome to Qianyu's terminal.\n\nFor a list of available commands, type 'help'.");
  }
  const help="Available commands:\n\nhelp        — available commands\nabout       — about Qianyu\nprojects    — research interests\neducation   — academic background\nsocials     — contact links\ncv          — full CV\necho        — print anything\nhistory     — command history\nwelcome     — welcome screen\nclear       — clear the terminal";
  function command(raw){
    const cmd=raw.trim(); if(!cmd)return;
    history.push(cmd);historyIndex=history.length;
    print("visitor@qianyu:~$ "+cmd,"command-line");
    const key=cmd.split(/\s+/)[0].toLowerCase();
    if(key==="clear")output.replaceChildren();
    else if(key==="help")print(help);
    else if(key==="welcome")welcome();
    else if(key==="about")print("Qianyu Xie / 谢浅羽\nAI & Robotics MSc student at CUHK-Shenzhen.\nInterested in multimodal intelligence, affective computing and generative models.");
    else if(key==="education") {print("CUHK-Shenzhen · MSc in AI & Robotics\nJilin University · B.S. in Electronic Information Science and Technology");link("Full academic background →","/");}
    else if(key==="projects"){print("Multimodal Large Language Models\nCross-modal Emotion Recognition\nDiffusion Transformers & Mixture-of-Experts");link("Research and selected publications →","/");}
    else if(key==="socials"){link("GitHub / QianyuXIE","https://github.com/QianyuXIE");link("LinkedIn / qianyu-xie-julie","https://linkedin.com/in/qianyu-xie-julie");link("Email / 225040249@link.cuhk.edu.cn","mailto:225040249@link.cuhk.edu.cn");}
    else if(key==="cv")link("Open full CV →","/");
    else if(key==="history")print(history.map((v,i)=>(i+1)+"  "+v).join("\n"));
    else if(key==="echo")print(cmd.slice(4).trimStart());
    else print("Command not found: "+key+". Type 'help' to explore.");
    output.parentElement.scrollTop=output.parentElement.scrollHeight;
  }
  welcome();
  $("#terminal-form").addEventListener("submit",e=>{e.preventDefault();command(input.value);input.value="";input.focus();input.scrollIntoView({block:"nearest"});});
  input.addEventListener("keydown",e=>{
    if(e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();historyIndex=Math.max(0,Math.min(history.length,historyIndex+(e.key==="ArrowUp"?-1:1)));input.value=history[historyIndex]||"";}
    if(e.ctrlKey&&e.key.toLowerCase()==="l"){e.preventDefault();output.replaceChildren();}
  });
}());
