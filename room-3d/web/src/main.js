import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const host = document.getElementById("room-webgl");
const viewport = document.getElementById("room-viewport");

const probe = document.createElement("canvas");
const supportsWebGL = Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));

if (host && viewport && supportsWebGL) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  const pixelRatioCap = window.matchMedia("(max-width: 720px)").matches ? 1.25 : 1.5;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const restingPixelRatio = Math.min(devicePixelRatio, pixelRatioCap);
  const draggingPixelRatio = Math.min(devicePixelRatio, 1);
  renderer.setPixelRatio(restingPixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  host.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f3ee);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.11;
  controls.enablePan = false;
  controls.minDistance = 12;
  controls.maxDistance = 30;
  controls.minPolarAngle = Math.PI * 0.18;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.rotateSpeed = 0.58;
  controls.zoomSpeed = 0.65;
  controls.target.set(0, 2.2, 1.1);
  camera.position.set(15.8, 12.2, 17.8);
  controls.update();

  const hemi = new THREE.HemisphereLight(0xffffff, 0xe8ddd0, 2.05);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xfff7e8, 3.2);
  keyLight.position.set(-7, -8, 14);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -15;
  keyLight.shadow.camera.right = 15;
  keyLight.shadow.camera.top = 15;
  keyLight.shadow.camera.bottom = -15;
  keyLight.shadow.bias = -0.0002;
  scene.add(keyLight);
  const fillLight = new THREE.PointLight(0xffbd80, 18, 22, 2);
  fillLight.position.set(7, -3, 7);
  scene.add(fillLight);
  const lampLight = new THREE.PointLight(0xff9d52, 22, 9, 2);
  lampLight.position.set(4, 5.8, 2.8);
  scene.add(lampLight);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const labels = {
    cv: "Open CV",
    research: "Research notes",
    photos: "Photography",
    music: "Currently listening",
    about: "About me",
    writing: "Research notes",
    lamp: "Switch light",
    whale: "A tiny secret"
  };
  let interactiveMeshes = [];
  let hovered = null;
  let model = null;
  let lampOn = true;
  let pointerDown = null;
  let draggedSincePointerDown = false;
  let controlsActive = false;
  let renderQueued = false;

  const nameMatchers = [
    [/(macbook|screen|terminal)/i, "cv"],
    [/(whiteboard|paper|pen|highlighter|research)/i, "research"],
    [/(turntable|vinyl|headphones)/i, "music"],
    [/(camera|film|polaroid|photo_frame)/i, "photos"],
    [/(bookshelf|book)/i, "about"],
    [/(lamp)/i, "lamp"],
    [/(whale)/i, "whale"]
  ];

  const tooltip = document.createElement("span");
  tooltip.className = "room-webgl-tooltip";
  tooltip.hidden = true;
  host.appendChild(tooltip);

  function interactionFor(object) {
    let current = object;
    while (current) {
      if (current.userData && current.userData.interaction) return current.userData.interaction;
      const match = nameMatchers.find(([matcher]) => matcher.test(current.name || ""));
      if (match) return match[1];
      current = current.parent;
    }
    return null;
  }

  function setPointer(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  }

  function pick(event) {
    setPointer(event);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(interactiveMeshes, false)[0];
    return hit ? interactionFor(hit.object) : null;
  }

  function setLamp(next) {
    lampOn = next;
    lampLight.intensity = lampOn ? 22 : 0;
    requestRender();
  }

  function setRenderQuality(pixelRatio) {
    if (renderer.getPixelRatio() === pixelRatio) return;
    renderer.setPixelRatio(pixelRatio);
    resize();
  }

  // A static scene should not occupy a GPU frame on every display refresh.
  // OrbitControls keeps the loop alive only while its damping is settling.
  function requestRender() {
    if (renderQueued || document.hidden) return;
    renderQueued = true;
    requestAnimationFrame(renderOnce);
  }

  function renderOnce() {
    renderQueued = false;
    const cameraChanged = controls.update();
    renderer.render(scene, camera);
    if (cameraChanged || controlsActive) requestRender();
  }

  function clearHover() {
    hovered = null;
    tooltip.hidden = true;
    renderer.domElement.style.cursor = controlsActive ? "grabbing" : "grab";
  }

  controls.addEventListener("start", () => {
    controlsActive = true;
    draggedSincePointerDown = true;
    setRenderQuality(draggingPixelRatio);
    clearHover();
    requestRender();
  });

  controls.addEventListener("end", () => {
    controlsActive = false;
    setRenderQuality(restingPixelRatio);
    renderer.domElement.style.cursor = "grab";
    requestRender();
  });

  controls.addEventListener("change", requestRender);

  renderer.domElement.addEventListener("pointerdown", (event) => {
    pointerDown = { x: event.clientX, y: event.clientY };
    draggedSincePointerDown = false;
  });

  renderer.domElement.addEventListener("pointermove", (event) => {
    if (pointerDown && Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 7) {
      draggedSincePointerDown = true;
    }
    // Picking every tiny key/book while OrbitControls is moving was the main
    // source of drag jank. Hover picking resumes as soon as the gesture ends.
    if (pointerDown || controlsActive) return;
    const interaction = pick(event);
    if (interaction === hovered) return;
    hovered = interaction;
    renderer.domElement.style.cursor = interaction ? "pointer" : "grab";
    tooltip.hidden = !interaction;
    tooltip.textContent = labels[interaction] || "Explore";
  });

  renderer.domElement.addEventListener("pointerup", () => {
    window.setTimeout(() => {
      pointerDown = null;
      draggedSincePointerDown = false;
    }, 0);
  });

  renderer.domElement.addEventListener("pointerleave", () => {
    clearHover();
  });

  renderer.domElement.addEventListener("click", (event) => {
    if (draggedSincePointerDown) return;
    const interaction = pick(event);
    if (!interaction) return;
    if (interaction === "lamp") {
      document.dispatchEvent(new CustomEvent("qianyu-room:lamp-toggle"));
      return;
    }
    document.dispatchEvent(new CustomEvent("qianyu-room:interaction", { detail: { name: interaction } }));
  });

  document.addEventListener("qianyu-room:lamp-changed", (event) => setLamp(Boolean(event.detail && event.detail.on)));

  new GLTFLoader().load(
    "/assets/room3d/qianyu-room.glb",
    (gltf) => {
      model = gltf.scene;
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (interactionFor(object)) interactiveMeshes.push(object);
      });
      scene.add(model);
      renderer.shadowMap.needsUpdate = true;
      viewport.classList.add("room-viewport--webgl");
      host.classList.add("is-ready");
      renderer.domElement.tabIndex = 0;
      requestRender();
      host.setAttribute("aria-label", "可旋转和缩放的浅羽 3D 房间。点击物件查看内容。");
    },
    undefined,
    () => {
      host.classList.add("has-error");
      host.textContent = "3D room could not load. The illustrated room remains available.";
    }
  );

  function resize() {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    requestRender();
  }

  new ResizeObserver(resize).observe(host);
  resize();
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) requestRender();
  });
}
