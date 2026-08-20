(function () {
  "use strict";

  var peel = document.getElementById("room-peel");
  var peelHost = document.getElementById("room-peel-host");
  var experience = document.getElementById("room-experience");
  var enterButton = document.getElementById("room-enter");
  var shell = document.getElementById("room-shell");
  var viewport = document.getElementById("room-viewport");
  var scene = document.getElementById("room-scene");
  var panelLayer = document.getElementById("room-panel-layer");
  var lampToolbar = document.getElementById("room-lamp-toggle");
  var lampObject = document.getElementById("room-lamp-object");
  var timeButton = document.getElementById("room-time-toggle");
  var resetButton = document.getElementById("room-reset");

  if (!peel || !experience || !enterButton || !shell || !viewport || !scene || !panelLayer) {
    return;
  }

  var closeButtons = experience.querySelectorAll("[data-room-close]");
  var panelCloseButtons = experience.querySelectorAll("[data-room-panel-close]");
  var hotspots = experience.querySelectorAll("[data-room-panel]");
  var panels = panelLayer.querySelectorAll("[data-panel-name]");
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var lastFocused = null;
  var activeHotspot = null;
  var activePanel = null;
  var panelTimer = null;
  var closingTimer = null;
  var pointers = {};
  var pointerCount = 0;
  var dragOrigin = null;
  var pinchOrigin = null;
  var camera = { x: 0, y: 0, zoom: 0.9 };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function defaultZoom() {
    var widthScale = (viewport.clientWidth || window.innerWidth) / 1240;
    var heightScale = (viewport.clientHeight || window.innerHeight) / 810;
    return clamp(Math.min(widthScale, heightScale), 0.5, 0.96);
  }

  function cameraLimits() {
    var scaledWidth = 1120 * camera.zoom;
    var scaledHeight = 720 * camera.zoom;
    return {
      x: Math.max(80, (scaledWidth - viewport.clientWidth) / 2 + 190),
      y: Math.max(60, (scaledHeight - viewport.clientHeight) / 2 + 145)
    };
  }

  function applyCamera(instant) {
    var limits = cameraLimits();
    camera.x = clamp(camera.x, -limits.x, limits.x);
    camera.y = clamp(camera.y, -limits.y, limits.y);
    scene.style.transition = instant ? "none" : "";
    scene.style.transform = "translate(calc(-50% + " + camera.x + "px), calc(-50% + " + camera.y + "px)) scale(" + camera.zoom + ")";
    if (instant) {
      window.requestAnimationFrame(function () {
        scene.style.transition = "";
      });
    }
  }

  function resetCamera(instant) {
    camera.x = 0;
    camera.y = 0;
    camera.zoom = defaultZoom();
    applyCamera(Boolean(instant));
  }

  function markExplored() {
    viewport.classList.add("is-explored");
  }

  function openRoom() {
    if (!experience.hidden) {
      return;
    }
    lastFocused = document.activeElement;
    window.clearTimeout(closingTimer);
    experience.hidden = false;
    experience.classList.remove("is-closing", "is-entered");
    viewport.classList.remove("is-explored");
    shell.setAttribute("aria-hidden", "true");
    peel.setAttribute("aria-expanded", "true");
    peelHost.classList.add("is-hidden");
    document.body.classList.add("room-body-locked");
    closePanel(false);
    window.requestAnimationFrame(function () {
      enterButton.focus();
    });
  }

  function enterRoom() {
    resetCamera(true);
    experience.classList.add("is-entered");
    shell.setAttribute("aria-hidden", "false");
    window.setTimeout(function () {
      viewport.focus();
    }, reducedMotion ? 20 : 460);
  }

  function closeRoom() {
    if (experience.hidden || experience.classList.contains("is-closing")) {
      return;
    }
    closePanel(false);
    experience.classList.add("is-closing");
    shell.setAttribute("aria-hidden", "true");
    closingTimer = window.setTimeout(function () {
      experience.hidden = true;
      experience.classList.remove("is-closing", "is-entered");
      peel.setAttribute("aria-expanded", "false");
      peelHost.classList.remove("is-hidden");
      document.body.classList.remove("room-body-locked");
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      } else {
        peel.focus();
      }
    }, reducedMotion ? 30 : 360);
  }

  function focusOnHotspot(hotspot) {
    var hotspotBox = hotspot.getBoundingClientRect();
    var viewportBox = viewport.getBoundingClientRect();
    var hotspotCenterX = hotspotBox.left + hotspotBox.width / 2;
    var hotspotCenterY = hotspotBox.top + hotspotBox.height / 2;
    camera.x += viewportBox.left + viewportBox.width / 2 - hotspotCenterX;
    camera.y += viewportBox.top + viewportBox.height / 2 - hotspotCenterY + 26;
    camera.zoom = clamp(Math.max(camera.zoom, viewportBox.width < 700 ? 0.68 : 0.96), 0.5, 1.18);
    applyCamera(false);
  }

  function getFocusable(container) {
    return Array.prototype.slice.call(container.querySelectorAll(
      "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )).filter(function (element) {
      return !element.hidden && element.offsetParent !== null;
    });
  }

  function showPanel(name, hotspot) {
    window.clearTimeout(panelTimer);
    if (activeHotspot) {
      activeHotspot.classList.remove("is-active");
    }
    activeHotspot = hotspot;
    activeHotspot.classList.add("is-active");
    focusOnHotspot(hotspot);

    panelTimer = window.setTimeout(function () {
      var target = panelLayer.querySelector("[data-panel-name='" + name + "']");
      if (!target) {
        return;
      }
      Array.prototype.forEach.call(panels, function (panel) {
        panel.hidden = panel !== target;
      });
      activePanel = target;
      panelLayer.hidden = false;
      var focusable = getFocusable(target);
      if (focusable.length) {
        focusable[0].focus();
      }
    }, reducedMotion ? 20 : 390);
  }

  function closePanel(restoreFocus) {
    var panelOpener = activeHotspot;
    window.clearTimeout(panelTimer);
    panelLayer.hidden = true;
    Array.prototype.forEach.call(panels, function (panel) {
      panel.hidden = true;
    });
    if (activeHotspot) {
      activeHotspot.classList.remove("is-active");
    }
    activePanel = null;
    activeHotspot = null;
    if (restoreFocus !== false && !experience.hidden) {
      if (panelOpener && typeof panelOpener.focus === "function") {
        panelOpener.focus();
      } else {
        viewport.focus();
      }
    }
  }

  function toggleLamp() {
    var on = experience.classList.toggle("is-lamp-on");
    if (lampToolbar) {
      lampToolbar.setAttribute("aria-pressed", String(on));
    }
    if (lampObject) {
      lampObject.setAttribute("aria-pressed", String(on));
    }
    document.dispatchEvent(new CustomEvent("qianyu-room:lamp-changed", { detail: { on: on } }));
  }

  function toggleTime() {
    var night = experience.classList.toggle("is-night");
    timeButton.setAttribute("aria-pressed", String(night));
    var icon = timeButton.querySelector(".room-time-icon");
    var label = timeButton.querySelector("em");
    if (icon) {
      icon.textContent = night ? "☾" : "☼";
    }
    if (label) {
      label.textContent = night ? "night" : "day";
    }
  }

  function pointerDistance() {
    var ids = Object.keys(pointers);
    if (ids.length < 2) {
      return 0;
    }
    var a = pointers[ids[0]];
    var b = pointers[ids[1]];
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  function pointerCenter() {
    var ids = Object.keys(pointers);
    var a = pointers[ids[0]];
    var b = ids.length > 1 ? pointers[ids[1]] : a;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function onPointerDown(event) {
    if (event.target.closest("button, a, .room-toolbar, .room-panel-layer")) {
      return;
    }
    pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
    pointerCount = Object.keys(pointers).length;
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add("is-dragging");
    markExplored();

    if (pointerCount === 1) {
      dragOrigin = { x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y };
    } else if (pointerCount === 2) {
      pinchOrigin = {
        distance: pointerDistance(),
        zoom: camera.zoom,
        center: pointerCenter(),
        cameraX: camera.x,
        cameraY: camera.y
      };
    }
  }

  function onPointerMove(event) {
    if (!pointers[event.pointerId]) {
      return;
    }
    pointers[event.pointerId] = { x: event.clientX, y: event.clientY };
    pointerCount = Object.keys(pointers).length;
    if (pointerCount === 1 && dragOrigin) {
      camera.x = dragOrigin.cameraX + event.clientX - dragOrigin.x;
      camera.y = dragOrigin.cameraY + event.clientY - dragOrigin.y;
      applyCamera(true);
    } else if (pointerCount >= 2 && pinchOrigin) {
      var center = pointerCenter();
      camera.zoom = clamp(pinchOrigin.zoom * pointerDistance() / Math.max(pinchOrigin.distance, 1), 0.5, 1.35);
      camera.x = pinchOrigin.cameraX + center.x - pinchOrigin.center.x;
      camera.y = pinchOrigin.cameraY + center.y - pinchOrigin.center.y;
      applyCamera(true);
    }
  }

  function onPointerUp(event) {
    delete pointers[event.pointerId];
    pointerCount = Object.keys(pointers).length;
    if (pointerCount === 0) {
      viewport.classList.remove("is-dragging");
      dragOrigin = null;
      pinchOrigin = null;
    } else if (pointerCount === 1) {
      var id = Object.keys(pointers)[0];
      dragOrigin = {
        x: pointers[id].x,
        y: pointers[id].y,
        cameraX: camera.x,
        cameraY: camera.y
      };
      pinchOrigin = null;
    }
  }

  peel.addEventListener("click", openRoom);
  enterButton.addEventListener("click", enterRoom);

  Array.prototype.forEach.call(closeButtons, function (button) {
    button.addEventListener("click", closeRoom);
  });

  Array.prototype.forEach.call(panelCloseButtons, function (button) {
    button.addEventListener("click", function () {
      closePanel(true);
    });
  });

  Array.prototype.forEach.call(hotspots, function (hotspot) {
    hotspot.addEventListener("click", function () {
      showPanel(hotspot.getAttribute("data-room-panel"), hotspot);
    });
  });

  if (lampToolbar) {
    lampToolbar.addEventListener("click", toggleLamp);
  }
  if (lampObject) {
    lampObject.addEventListener("click", toggleLamp);
  }
  if (timeButton) {
    timeButton.addEventListener("click", toggleTime);
  }
  if (resetButton) {
    resetButton.addEventListener("click", function () {
      resetCamera(false);
      markExplored();
    });
  }

  document.addEventListener("qianyu-room:interaction", function (event) {
    var name = event.detail && event.detail.name;
    var mappedName = name === "writing" ? "research" : name;
    var hotspot = experience.querySelector("[data-room-panel='" + mappedName + "']");
    if (hotspot) {
      showPanel(mappedName, hotspot);
    }
  });

  document.addEventListener("qianyu-room:lamp-toggle", toggleLamp);

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerUp);
  viewport.addEventListener("wheel", function (event) {
    event.preventDefault();
    camera.zoom = clamp(camera.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.5, 1.35);
    applyCamera(false);
    markExplored();
  }, { passive: false });

  viewport.addEventListener("keydown", function (event) {
    var handled = true;
    var step = event.shiftKey ? 70 : 34;
    if (event.key === "ArrowLeft") {
      camera.x += step;
    } else if (event.key === "ArrowRight") {
      camera.x -= step;
    } else if (event.key === "ArrowUp") {
      camera.y += step;
    } else if (event.key === "ArrowDown") {
      camera.y -= step;
    } else if (event.key === "+" || event.key === "=") {
      camera.zoom = clamp(camera.zoom * 1.1, 0.5, 1.35);
    } else if (event.key === "-" || event.key === "_") {
      camera.zoom = clamp(camera.zoom / 1.1, 0.5, 1.35);
    } else if (event.key === "0") {
      resetCamera(false);
      event.preventDefault();
      return;
    } else {
      handled = false;
    }
    if (handled) {
      event.preventDefault();
      applyCamera(false);
      markExplored();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (experience.hidden) {
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (activePanel) {
        closePanel(true);
      } else {
        closeRoom();
      }
      return;
    }
    if (event.key === "Tab" && activePanel) {
      var focusable = getFocusable(activePanel);
      if (!focusable.length) {
        event.preventDefault();
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (!activePanel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  window.addEventListener("resize", function () {
    if (!experience.hidden && experience.classList.contains("is-entered") && !activePanel) {
      resetCamera(true);
    }
  });
}());
