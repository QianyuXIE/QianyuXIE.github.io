// Keep the page shell responsive first; the 3D runtime is loaded once the
// browser has had a chance to paint navigation and the illustrated fallback.
const startRoom = () => import("./room-runtime.js");

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(startRoom, { timeout: 900 });
} else {
  window.setTimeout(startRoom, 0);
}
