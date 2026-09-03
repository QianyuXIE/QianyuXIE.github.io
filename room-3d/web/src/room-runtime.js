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
  scene.background = new THREE.Color(0xe8e6df);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.11;
  controls.enablePan = false;
  controls.minDistance = 10;
  controls.maxDistance = 25;
  controls.minPolarAngle = Math.PI * 0.20;
  controls.maxPolarAngle = Math.PI * 0.43;
  controls.rotateSpeed = 0.52;
  controls.zoomSpeed = 0.65;
  controls.target.set(0, 3.0, -1.8);
  camera.position.set(10.8, 9.5, 16.0);
  controls.update();

  const overviewPose = {
    position: new THREE.Vector3(10.8, 9.5, 16.0),
    target: new THREE.Vector3(0, 3.0, -1.8)
  };
  const cameraPoses = {
    cv: {
      position: new THREE.Vector3(0, 4.8, 2.7),
      target: new THREE.Vector3(-0.15, 3.65, -1.35)
    },
    research: {
      position: new THREE.Vector3(-3.7, 5.5, -0.5),
      target: new THREE.Vector3(-3.72, 5.18, -5.18)
    },
    photos: {
      position: new THREE.Vector3(-1.55, 4.45, 2.0),
      target: new THREE.Vector3(-1.55, 3.3, -1.05)
    },
    music: {
      position: new THREE.Vector3(2.35, 4.7, 2.2),
      target: new THREE.Vector3(2.38, 3.18, -1.15)
    },
    about: {
      position: new THREE.Vector3(2.0, 5.7, -0.7),
      target: new THREE.Vector3(2.02, 5.42, -5.12)
    }
  };

  const hemi = new THREE.HemisphereLight(0xffffff, 0xd6d2ca, 1.55);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xfff8eb, 2.65);
  keyLight.position.set(-7, 12, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -15;
  keyLight.shadow.camera.right = 15;
  keyLight.shadow.camera.top = 15;
  keyLight.shadow.camera.bottom = -15;
  keyLight.shadow.bias = -0.0002;
  scene.add(keyLight);
  const fillLight = new THREE.PointLight(0xe8edf0, 8, 24, 2);
  fillLight.position.set(7, 6, 9);
  scene.add(fillLight);
  const lampLight = new THREE.PointLight(0xffb66d, 12, 9, 2);
  lampLight.position.set(-3.2, 5.0, -0.6);
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
  let hoveredObject = null;
  let model = null;
  let vinyl = null;
  let lampOn = true;
  let isNight = false;
  let recordSpinning = false;
  let lastRenderTime = 0;
  let pointerDown = null;
  let draggedSincePointerDown = false;
  let controlsActive = false;
  let renderQueued = false;
  let focusToken = 0;

  const nameMatchers = [
    [/(macbook|screen|terminal)/i, "cv"],
    [/(whiteboard|paper|pen|research)/i, "research"],
    [/(turntable|vinyl|headphones|wall_record)/i, "music"],
    [/(camera|film|polaroid)/i, "photos"],
    [/(about_frame)/i, "about"],
    [/(lamp)/i, "lamp"],
    [/(whale)/i, "whale"]
  ];

  // Only the broad, intentional surfaces participate in raycasting.  The
  // scene contains many visual details (individual keys, books and grooves),
  // but they should not turn every pointer move into dozens of mesh tests.
  const hitTargetMatchers = [
    [/^macbook_air_(base|deck|lid|screen|trackpad)$/i, "cv"],
    [/^(whiteboard_(paper|top_rail)|research_paper_00)$/i, "research"],
    [/^(turntable_body|vinyl|headphones_band|wall_record_\d+)$/i, "music"],
    [/^camera_body$/i, "photos"],
    [/^about_frame$/i, "about"],
    [/^(lamp_(shade|stem|stand)|floor_lamp_(shade|stem))$/i, "lamp"]
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

  function hitTargetFor(object) {
    const match = hitTargetMatchers.find(([matcher]) => matcher.test(object.name || ""));
    return match ? match[1] : null;
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
    return hit ? { object: hit.object, interaction: interactionFor(hit.object) } : null;
  }

  function materialList(object) {
    if (!object || !object.material) return [];
    return Array.isArray(object.material) ? object.material : [object.material];
  }

  function setObjectHighlight(object, active) {
    materialList(object).forEach((material) => {
      if (!material || !material.emissive) return;
      if (!material.userData.roomHighlightOriginal) {
        material.userData.roomHighlightOriginal = {
          emissive: material.emissive.getHex(),
          emissiveIntensity: material.emissiveIntensity
        };
      }
      const original = material.userData.roomHighlightOriginal;
      if (active) {
        material.emissive.setHex(0xc9b991);
        material.emissiveIntensity = Math.max(original.emissiveIntensity, 0.14);
      } else {
        material.emissive.setHex(original.emissive);
        material.emissiveIntensity = original.emissiveIntensity;
      }
    });
  }

  function setHovered(picked) {
    const nextObject = picked ? picked.object : null;
    const nextInteraction = picked ? picked.interaction : null;
    if (nextObject === hoveredObject && nextInteraction === hovered) return;
    setObjectHighlight(hoveredObject, false);
    hoveredObject = nextObject;
    hovered = nextInteraction;
    setObjectHighlight(hoveredObject, Boolean(hovered));
    renderer.domElement.style.cursor = hovered ? "pointer" : "grab";
    tooltip.hidden = !hovered;
    tooltip.textContent = labels[hovered] || "Explore";
    requestRender();
  }

  function fallbackPose(object) {
    if (!object) return overviewPose;
    const destinationTarget = new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
    const direction = camera.position.clone().sub(controls.target).normalize();
    return {
      target: destinationTarget,
      position: destinationTarget.clone().add(direction.multiplyScalar(8.5))
    };
  }

  function animateCamera(pose, durationOverride) {
    if (!pose) return;
    const startTarget = controls.target.clone();
    const startPosition = camera.position.clone();
    const token = ++focusToken;
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : (durationOverride || 560);

    function step(now, startedAt) {
      if (token !== focusToken) return;
      const elapsed = duration ? (now - startedAt) / duration : 1;
      const progress = Math.min(Math.max(elapsed, 0), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      controls.target.lerpVectors(startTarget, pose.target, eased);
      camera.position.lerpVectors(startPosition, pose.position, eased);
      renderer.render(scene, camera);
      if (progress < 1) requestAnimationFrame((next) => step(next, startedAt));
    }

    requestAnimationFrame((startedAt) => step(startedAt, startedAt));
  }

  function setLamp(next) {
    lampOn = next;
    lampLight.intensity = lampOn ? (isNight ? 28 : 16) : 0;
    requestRender();
  }

  function setTimeOfDay(night) {
    isNight = night;
    scene.background.setHex(night ? 0x171a1d : 0xe8e6df);
    hemi.intensity = night ? 0.38 : 1.55;
    keyLight.intensity = night ? 0.55 : 2.65;
    keyLight.color.setHex(night ? 0xa9c1de : 0xfff8eb);
    fillLight.intensity = night ? 2.8 : 8;
    renderer.toneMappingExposure = night ? 0.9 : 1.08;
    setLamp(lampOn);
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

  function renderOnce(now) {
    renderQueued = false;
    const delta = lastRenderTime ? Math.min((now - lastRenderTime) / 1000, 0.05) : 0;
    lastRenderTime = now;
    if (recordSpinning && vinyl) vinyl.rotation.y += delta * 0.78;
    const cameraChanged = controls.update();
    renderer.render(scene, camera);
    if (cameraChanged || controlsActive || recordSpinning) requestRender();
  }

  function clearHover() {
    setObjectHighlight(hoveredObject, false);
    hovered = null;
    hoveredObject = null;
    tooltip.hidden = true;
    renderer.domElement.style.cursor = controlsActive ? "grabbing" : "grab";
    requestRender();
  }

  controls.addEventListener("start", () => {
    focusToken += 1;
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
    setHovered(pick(event));
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
    const picked = pick(event);
    const interaction = picked ? picked.interaction : null;
    if (!interaction) return;
    if (interaction === "lamp") {
      document.dispatchEvent(new CustomEvent("qianyu-room:lamp-toggle"));
      return;
    }
    animateCamera(cameraPoses[interaction] || fallbackPose(picked.object));
    document.dispatchEvent(new CustomEvent("qianyu-room:interaction", { detail: { name: interaction } }));
  });

  document.addEventListener("qianyu-room:lamp-changed", (event) => setLamp(Boolean(event.detail && event.detail.on)));
  document.addEventListener("qianyu-room:time-changed", (event) => setTimeOfDay(Boolean(event.detail && event.detail.night)));
  document.addEventListener("qianyu-room:camera-reset", () => animateCamera(overviewPose, 620));
  document.addEventListener("qianyu-room:panel-changed", (event) => {
    const detail = event.detail || {};
    recordSpinning = Boolean(detail.open && detail.name === "music");
    requestRender();
  });

  new GLTFLoader().load(
    "/assets/room3d/qianyu-room.glb",
    (gltf) => {
      model = gltf.scene;
      model.traverse((object) => {
        if (/^vinyl$/i.test(object.name || "")) vinyl = object;
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        if (hitTargetFor(object)) {
          // Interactive surfaces get their own material instance so a hover
          // highlight never alters visually similar, non-interactive details.
          object.material = Array.isArray(object.material)
            ? object.material.map((material) => material.clone())
            : object.material.clone();
          interactiveMeshes.push(object);
        }
      });
      scene.add(model);
      renderer.shadowMap.needsUpdate = true;
      viewport.classList.add("room-viewport--webgl");
      host.classList.add("is-ready");
      renderer.domElement.tabIndex = 0;
      requestRender();
      host.setAttribute("aria-label", "可旋转和缩放的浅羽 3D 工作室。点击物件查看内容。");
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
