// UCI proxy worker for Fairy-Stockfish.
//
// Fairy-Stockfish ships as a `Stockfish()` factory (stockfish.js) plus a
// pthread worker template (stockfish.worker.js) and a wasm binary. It does
// NOT ship a self-contained UCI worker like the plain stockfish.js package.
// This shim runs inside a dedicated Web Worker, instantiates the engine,
// and proxies UCI strings both ways between the main thread and the
// engine module.
//
// Variants.ini is read from the engine's virtual (Emscripten) filesystem,
// NOT from the network. We fetch it over HTTP at startup, then write it
// to a fixed path inside the engine's FS (`/variants.ini`). The wrapper
// then sends `setoption name VariantPath value /variants.ini` after
// `uciok` to load the file. Any commands posted before the engine is
// alive are queued and drained once it's up.
//
// Init progress / failures are surfaced as `info string` lines so a
// hung handshake is diagnosable from the wrapper / devtools console.
//
// Requires SharedArrayBuffer / cross-origin isolation; the page must be
// served with COEP: require-corp + COOP: same-origin headers.

importScripts("./stockfish.js");

let engine = null;
const queue = [];

function note(msg) {
  // UCI-shaped status line; the wrapper tees these to console.log so they
  // surface in the main-thread devtools without polluting the bestmove
  // protocol.
  self.postMessage(`info string [proxy] ${msg}`);
}

self.addEventListener("error", function (e) {
  note(`worker error: ${e.message ?? e}`);
});
self.addEventListener("unhandledrejection", function (e) {
  note(`unhandled rejection: ${e.reason && e.reason.message ? e.reason.message : e.reason}`);
});

(async function init() {
  try {
    if (typeof SharedArrayBuffer === "undefined") {
      note("SharedArrayBuffer unavailable — check COEP/COOP headers");
    }
    note("init: starting");

    let variantsText = "";
    try {
      const res = await fetch("./variants.ini");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      variantsText = await res.text();
      note(`init: variants.ini fetched (${variantsText.length} bytes)`);
    } catch (e) {
      note(`init: variants.ini fetch failed: ${e.message ?? e}`);
    }

    note("init: instantiating engine");
    // Inside a Web Worker, `document.currentScript` is undefined, so the
    // engine's internal `_scriptDir` is empty. When it spawns a pthread
    // worker it posts `urlOrBlob: mainScriptUrlOrBlob || _scriptDir`, and
    // the pthread template does `URL.createObjectURL(undefined)` — which
    // throws and aborts boot. Provide an explicit URL for the main script
    // (and use the same base for sibling files via `locateFile`).
    const baseUrl = self.location.href;
    const mod = await Stockfish({
      mainScriptUrlOrBlob: new URL("./stockfish.js", baseUrl).href,
      locateFile: function (file) {
        return new URL("./" + file, baseUrl).href;
      },
    });
    note("init: engine instantiated");

    if (variantsText) {
      mod.FS.writeFile("/variants.ini", variantsText);
      note("init: variants.ini written to FS");
    }

    mod.addMessageListener(function (line) {
      self.postMessage(line);
    });
    engine = mod;
    note(`init: ready (draining ${queue.length} queued)`);
    while (queue.length > 0) {
      engine.postMessage(queue.shift());
    }
  } catch (e) {
    note(`init failed: ${e && e.message ? e.message : e}`);
  }
})();

self.onmessage = function (e) {
  const cmd = e.data;
  if (typeof cmd !== "string") return;
  if (engine) {
    engine.postMessage(cmd);
  } else {
    queue.push(cmd);
  }
};
