// Register a require hook for 'server-only' to prevent crashes in Node scripts
try {
  const Module = require("module");
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "server-only") {
      return require("path").resolve(__dirname, "server-only-shim.ts");
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
} catch (_) {
  // best effort
}
