const e = () => import("./room-runtime-CrxoMahX.js").then((t) => t.r);
"requestIdleCallback" in window ? window.requestIdleCallback(e, { timeout: 900 }) : window.setTimeout(e, 0);
