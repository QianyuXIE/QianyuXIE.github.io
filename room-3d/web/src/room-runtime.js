import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import interactionTargets from "../../interaction-targets.json";

const host = document.getElementById("room-webgl");
const viewport = document.getElementById("room-viewport");
const loadingScreen = document.getElementById("room-loading");
const loadingLabel = document.getElementById("room-loading-label");
const loadingProgress = document.getElementById("room-loading-progress");
const loadingValue = document.getElementById("room-loading-value");

const probe = document.createElement("canvas");
const supportsWebGL = Boolean(probe.getContext("webgl2") || probe.getContext("webgl"));

function setLoadingProgress(value) {
  const progress = Math.min(Math.max(Math.round(value), 0), 100);
  if (loadingProgress) loadingProgress.style.width = `${progress}%`;
  if (loadingValue) loadingValue.value = `${String(progress).padStart(3, "0")}%`;
}

if (host && viewport && !supportsWebGL && loadingScreen) {
  loadingScreen.classList.add("has-error");
  if (loadingLabel) loadingLabel.textContent = "WebGL is not available";
  if (loadingValue) loadingValue.value = "—";
}

if (host && viewport && supportsWebGL) {
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  const pixelRatioCap = window.matchMedia("(max-width: 720px)").matches ? 1 : 1.25;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const restingPixelRatio = Math.min(devicePixelRatio, pixelRatioCap);
  renderer.setPixelRatio(restingPixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  host.replaceChildren(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);
  // Metal needs reflected studio illumination as well as direct light.
  const environmentRoom = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environmentMap = pmrem.fromScene(environmentRoom, 0.04);
  scene.environment = environmentMap.texture;
  scene.environmentIntensity = 0.20;
  environmentRoom.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.11;
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.panSpeed = 0.8;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
  controls.minDistance = 2;
  controls.maxDistance = 36;
  controls.minPolarAngle = Math.PI * 0.20;
  controls.maxPolarAngle = Math.PI * 0.43;
  controls.minAzimuthAngle = -Math.PI * 0.40;
  controls.maxAzimuthAngle = Math.PI * 0.40;
  controls.rotateSpeed = 0.52;
  controls.zoomSpeed = 0.65;
  controls.target.set(1, 3.0, -.8);
  camera.position.set(-10.8, 11.2, 21.3);
  controls.update();

  const overviewPose = {
    position: new THREE.Vector3(-10.8, 11.2, 21.3),
    target: new THREE.Vector3(1, 3.0, -.8)
  };
  const cameraPoses = {
    cv: {
      position: new THREE.Vector3(0.05, 3.8, 1.45),
      target: new THREE.Vector3(0.05, 3.60, -1.40)
    },
    research: {
      position: new THREE.Vector3(-3.0, 5.60, 1.8),
      target: new THREE.Vector3(-2.88, 5.37, -3.48)
    },
    photos: {
      position: new THREE.Vector3(-3.15, 4.00, 1.90),
      target: new THREE.Vector3(-2.29, 3.22, -.57)
    },
    music: {
      position: new THREE.Vector3(.60, 5.00, 2.40),
      target: new THREE.Vector3(2.25, 3.22, -1.02)
    },
    about: {
      position: new THREE.Vector3(1.83, 5.70, 1.5),
      target: new THREE.Vector3(1.83, 5.58, -3.46)
    },
    books: {
      position: new THREE.Vector3(-.6, 6.1, 1.5),
      target: new THREE.Vector3(-.1, 6.1, -3.2)
    }
  };

  function responsivePose(pose) {
    if (host.clientWidth >= 720 || host.clientWidth / Math.max(host.clientHeight, 1) > 0.82) return pose;
    const direction = pose.position.clone().sub(pose.target).multiplyScalar(1.38);
    return { position: pose.target.clone().add(direction), target: pose.target.clone() };
  }

  function currentOverviewPose() {
    if (host.clientWidth < 600) {
      return {
        position: new THREE.Vector3(-13.0, 13.5, 29.0),
        target: overviewPose.target.clone()
      };
    }
    if (host.clientWidth < 900) {
      return {
        position: new THREE.Vector3(-11.0, 12.0, 24.0),
        target: overviewPose.target.clone()
      };
    }
    return { position: overviewPose.position.clone(), target: overviewPose.target.clone() };
  }

  const hemi = new THREE.HemisphereLight(0xe6eaf0, 0x82786c, 0.38);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xfff2dc, 2.8);
  keyLight.position.set(-6, 8.5, 4);
  keyLight.target.position.set(0, 2.3, -1.6);
  scene.add(keyLight.target);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.left = -9;
  keyLight.shadow.camera.right = 9;
  keyLight.shadow.camera.top = 9;
  keyLight.shadow.camera.bottom = -9;
  keyLight.shadow.normalBias = .012;
  keyLight.shadow.bias = -0.0002;
  scene.add(keyLight);
  const fillLight = new THREE.PointLight(0xe8edf0, 1.5, 24, 2);
  fillLight.position.set(7, 6, 9);
  scene.add(fillLight);
  const lampLight = new THREE.PointLight(0xffb66d, 0, 9, 2);
  lampLight.position.set(-2.55, 3.85, -1.43);
  scene.add(lampLight);
  // Warm fabric and downward spill, without six-face point-light shadow maps.
  const floorLampLight = new THREE.PointLight(0xffd69a, 0, 6, 2);
  floorLampLight.position.set(-5.12, 3.68, -.15);
  scene.add(floorLampLight);
  const floorLampPool = new THREE.SpotLight(0xffd29a, 0, 8, .72, .75, 2);
  floorLampPool.position.set(-5.12, 3.46, -.15);
  floorLampPool.target.position.set(-5.12, 0, -.15);
  scene.add(floorLampPool, floorLampPool.target);
  const lampSurfaces = [];

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const labels = {
    cv: "Terminal / Qianyu",
    research: "Research notes",
    photos: "Photography",
    music: "Currently listening",
    about: "Cinema / Watched films",
    writing: "Research notes",
    lamp: "Switch light",
    whale: "A tiny secret"
    , paper: "Open full CV", books: "Notes & reading", chair: "Swivel chair", guitar: "Electric guitar"
  };
  let interactiveMeshes = [];
  let hovered = null;
  let hoveredObject = null;
  let model = null;
  let vinyl = null;
  let recordPivot = null;
  let recordParts = [];
  let lampOn = false;
  let isNight = false;
  let recordSpinning = false;
  let lastRenderTime = 0;
  let pointerDown = null;
  let draggedSincePointerDown = false;
  let controlsActive = false;
  let renderQueued = false;
  let focusToken = 0;
  let panelOpen = false;
  let boardTexture = null;
  let boardMesh = null;
  let labelMaterial = null;
  let recordRequested = false;
  let cameraAnimating = false;
  let chairPivot = null;
  const chairParts = [];

  const tooltip = document.createElement("span");
  tooltip.className = "room-webgl-tooltip";
  tooltip.hidden = true;
  host.appendChild(tooltip);

  function interactionFor(object) {
    return interactionTargets[object.name] || null;
  }

  function hitTargetFor(object) {
    return interactionFor(object);
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
    cameraAnimating = true;
    const duration = reducedMotionQuery.matches
      ? 0
      : (durationOverride || 560);

    function step(now, startedAt) {
      if (token !== focusToken) return;
      const elapsed = duration ? (now - startedAt) / duration : 1;
      const progress = Math.min(Math.max(elapsed, 0), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      controls.target.lerpVectors(startTarget, pose.target, eased);
      camera.position.lerpVectors(startPosition, pose.position, eased);
      camera.lookAt(controls.target);
      requestRender();
      if (progress < 1) requestAnimationFrame((next) => step(next, startedAt));
      else {
        cameraAnimating = false;
        const damping = controls.enableDamping;
        controls.enableDamping = false;
        if (!panelOpen) controls.update();
        controls.enableDamping = damping;
        requestRender();
      }
    }

    requestAnimationFrame((startedAt) => step(startedAt, startedAt));
  }

  function setLamp(next) {
    lampOn = next;
    lampLight.intensity = lampOn ? (isNight ? 28 : 16) : 0;
    floorLampLight.intensity = lampOn ? (isNight ? 13 : 9) : 0;
    floorLampPool.intensity = lampOn ? (isNight ? 65 : 48) : 0;
    lampSurfaces.forEach(({ material, strength }) => {
      material.emissive.setHex(0xffcf88);
      material.emissiveIntensity = lampOn ? strength : 0;
      delete material.userData.roomHighlightOriginal;
    });
    requestRender();
  }

  function setTimeOfDay(night) {
    isNight = night;
    scene.environmentIntensity = night ? 0.08 : 0.20;
    scene.background.setHex(night ? 0x282d35 : 0xffffff);
    hemi.intensity = night ? 0.16 : 0.38;
    keyLight.intensity = night ? 0.28 : 2.8;
    keyLight.color.setHex(night ? 0xa9c1de : 0xfff2dc);
    fillLight.intensity = night ? .65 : 1.5;
    renderer.toneMappingExposure = night ? 0.78 : 0.82;
    setLamp(lampOn);
    requestRender();
  }

  function nudgeCamera(key, fast) {
    focusToken += 1;
    cameraAnimating = false;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const angleStep = fast ? 0.18 : 0.09;
    if (key === "ArrowLeft") spherical.theta -= angleStep;
    if (key === "ArrowRight") spherical.theta += angleStep;
    if (key === "ArrowUp") spherical.phi = Math.max(controls.minPolarAngle, spherical.phi - angleStep);
    if (key === "ArrowDown") spherical.phi = Math.min(controls.maxPolarAngle, spherical.phi + angleStep);
    if (key === "+" || key === "=") spherical.radius = Math.max(controls.minDistance, spherical.radius * 0.9);
    if (key === "-" || key === "_") spherical.radius = Math.min(controls.maxDistance, spherical.radius * 1.1);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();
    requestRender();
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
    if (recordSpinning && recordPivot) recordPivot.rotation.y += delta * 3.49;
    const cameraChanged = cameraAnimating || panelOpen ? false : controls.update();
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
    cameraAnimating = false;
    controlsActive = true;
    clearHover();
    requestRender();
  });

  controls.addEventListener("end", () => {
    controlsActive = false;
    renderer.domElement.style.cursor = "grab";
    requestRender();
  });

  controls.addEventListener("change", requestRender);
  renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());

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
  renderer.domElement.addEventListener("pointercancel", () => {
    pointerDown = null;
    draggedSincePointerDown = true;
    controlsActive = false;
    clearHover();
  });

  renderer.domElement.addEventListener("click", (event) => {
    if (event.button !== 0 || draggedSincePointerDown || panelOpen) return;
    const picked = pick(event);
    const interaction = picked ? picked.interaction : null;
    if (!interaction) return;
    if (interaction === "lamp") {
      document.dispatchEvent(new CustomEvent("qianyu-room:lamp-toggle"));
      return;
    }
    if (interaction === "paper") { window.location.assign("/"); return; }
    if (interaction === "chair" && chairPivot) {
      const start = chairPivot.rotation.y;
      const began = performance.now();
      function swivel(now) {
        const t = reducedMotionQuery.matches ? 1 : Math.min((now-began)/900,1);
        chairPivot.rotation.y = start + Math.PI*.5*(1-Math.pow(1-t,3));
        renderer.shadowMap.needsUpdate = true;
        requestRender();
        if(t<1) requestAnimationFrame(swivel);
      }
      requestAnimationFrame(swivel);
      return;
    }
    if (interaction === "guitar") {
      animateCamera(responsivePose(fallbackPose(picked.object)));
      return;
    }
    animateCamera(responsivePose(cameraPoses[interaction] || fallbackPose(picked.object)));
    document.dispatchEvent(new CustomEvent("qianyu-room:interaction", { detail: { name: interaction } }));
  });

  document.addEventListener("qianyu-room:lamp-changed", (event) => setLamp(Boolean(event.detail && event.detail.on)));
  document.addEventListener("qianyu-room:time-changed", (event) => setTimeOfDay(Boolean(event.detail && event.detail.night)));
  document.addEventListener("qianyu-room:camera-reset", () => animateCamera(currentOverviewPose(), 620));
  document.addEventListener("qianyu-room:focus-request", (event) => {
    const interaction = event.detail && event.detail.name;
    if (interaction && cameraPoses[interaction]) animateCamera(responsivePose(cameraPoses[interaction]));
  });
  document.addEventListener("qianyu-room:camera-key", (event) => {
    const detail = event.detail || {};
    if (detail.key === "0") animateCamera(currentOverviewPose(), 620);
    else nudgeCamera(detail.key, Boolean(detail.fast));
  });
  document.addEventListener("qianyu-room:panel-changed", (event) => {
    const detail = event.detail || {};
    panelOpen = Boolean(detail.open);
    controls.enabled = !panelOpen;
    requestRender();
  });
  document.addEventListener("qianyu-room:record-selected", event => {
    recordRequested = Boolean(event.detail.spinning);
    recordSpinning = recordRequested && !reducedMotionQuery.matches;
    if (labelMaterial) labelMaterial.color.setHex(event.detail.color);
    requestRender();
  });
  reducedMotionQuery.addEventListener("change", () => {
    recordSpinning = recordRequested && !reducedMotionQuery.matches;
    requestRender();
  });
  document.addEventListener("qianyu-room:board-updated", event => {
    if (!boardMesh) return;
    if (!boardTexture) {
      boardTexture = new THREE.CanvasTexture(event.detail.canvas);
      boardTexture.colorSpace = THREE.SRGBColorSpace;
      boardTexture.flipY = false;
      boardMesh.material.map = boardTexture;
      boardMesh.material.color.setHex(0xffffff);
      boardMesh.material.needsUpdate = true;
    }
    boardTexture.needsUpdate = true;
    requestRender();
  });

  new GLTFLoader().load(
    "/assets/room3d/qianyu-room.glb?v=20260911",
    (gltf) => {
      model = gltf.scene;
      model.traverse((object) => {
        if (object.userData.room_group === "chair") chairParts.push(object);
        if (/^vinyl$/i.test(object.name || "")) vinyl = object;
        if (object.userData.room_group === "record") recordParts.push(object);
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        materialList(object).forEach(material => {
          // Alpha + environment reflections avoid a full-scene transmission pass.
          if (material.transmission > 0) { material.transmission = 0; material.needsUpdate = true; }
          if (material.transparent) { object.castShadow = false; material.depthWrite = false; }
        });
        if (object.name === "studio_floor") {
          object.material = object.material.clone();
          object.material.color.setHex(0xaaa69d);
          object.castShadow = false;
        }
        if (object.name === "studio_glass_wall") {
          object.material.side = THREE.DoubleSide;
          object.material.opacity = .16;
          object.material.roughness = .18;
          object.castShadow = false;
          const wallShadow = new THREE.Mesh(object.geometry, new THREE.ShadowMaterial({ opacity: .22, side: THREE.DoubleSide, depthWrite: false }));
          wallShadow.name = "glass_shadow_receiver";
          wallShadow.position.copy(object.position);
          wallShadow.quaternion.copy(object.quaternion);
          wallShadow.scale.copy(object.scale);
          wallShadow.position.z += .006;
          wallShadow.receiveShadow = true;
          scene.add(wallShadow);
        }
        if (hitTargetFor(object)) {
          // Interactive surfaces get their own material instance so a hover
          // highlight never alters visually similar, non-interactive details.
          object.material = Array.isArray(object.material)
            ? object.material.map((material) => material.clone())
            : object.material.clone();
          interactiveMeshes.push(object);
        }
        if (object.name === "whiteboard_paper") boardMesh = object;
        if (object.name === "vinyl_label") labelMaterial = object.material;
        if (["floor_lamp_shade", "floor_lamp_bulb", "lamp_inner"].includes(object.name)) {
          object.material = object.material.clone();
          lampSurfaces.push({ material: object.material, strength: object.name === "floor_lamp_bulb" ? 2.2 : .65 });
        }
      });
      scene.add(model);
      if (chairParts.length) {
        chairPivot = new THREE.Group();
        chairPivot.position.set(1.25, 0, 1.60);
        model.add(chairPivot);
        model.updateMatrixWorld(true);
        chairParts.forEach(part => chairPivot.attach(part));
      }
      if (vinyl && recordParts.length) {
        model.updateMatrixWorld(true);
        const pivotPosition = vinyl.position.clone();
        recordPivot = new THREE.Group();
        recordPivot.name = "vinyl_spin_pivot";
        recordPivot.position.copy(pivotPosition);
        model.add(recordPivot);
        recordPivot.updateMatrixWorld(true);
        recordParts.forEach((part) => recordPivot.attach(part));
      }
      renderer.shadowMap.needsUpdate = true;
      // Static mesh transforms stay cached; animated parent pivots still update.
      model.traverse(object => { if (object.isMesh) { object.updateMatrix(); object.matrixAutoUpdate = false; } });
      setLamp(lampOn);
      viewport.classList.add("room-viewport--webgl");
      host.classList.add("is-ready");
      document.dispatchEvent(new CustomEvent("qianyu-room:ready"));
      viewport.tabIndex = -1;
      renderer.domElement.tabIndex = 0;
      renderer.domElement.setAttribute("role", "application");
      renderer.domElement.setAttribute("aria-label", "浅羽的三维工作室。左键旋转，右键平移，滚轮缩放。方向键旋转，加减号缩放，数字 1 到 5 打开终端、白板、摄影、音乐和电影海报，L 开关灯，N 切换昼夜，0 返回总览。");
      renderer.domElement.title = "左键旋转 · 右键平移 · 滚轮缩放 · 0 回到总览";
      setLoadingProgress(100);
      if (loadingLabel) loadingLabel.textContent = "room ready";
      requestRender();
      host.setAttribute("aria-label", "可旋转、平移和缩放的浅羽 3D 工作室。点击物件查看内容。");

      if (loadingScreen) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            loadingScreen.classList.add("is-complete");
            window.setTimeout(() => {
              loadingScreen.hidden = true;
            }, reducedMotionQuery.matches ? 20 : 420);
          });
        });
      }
    },
    (event) => {
      if (!event.lengthComputable || !event.total) return;
      setLoadingProgress(Math.min((event.loaded / event.total) * 100, 96));
    },
    () => {
      host.classList.add("has-error");
      if (loadingScreen) loadingScreen.classList.add("has-error");
      if (loadingLabel) loadingLabel.textContent = "room could not load — refresh to retry";
      if (loadingValue) loadingValue.value = "ERR";
    }
  );

  function resize() {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    if (!model) {
      const pose = currentOverviewPose();
      camera.position.copy(pose.position);
      controls.target.copy(pose.target);
      controls.update();
    }
    camera.aspect = width / height;
    camera.fov = width < 600 ? 40 : width < 900 ? 35 : 32;
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
