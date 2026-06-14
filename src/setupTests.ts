import "@testing-library/jest-dom";

// Polyfill fetch for jsdom (Clerk's @clerk/backend uses fetch at module load time).
// node-fetch-native is CJS-compatible.
if (typeof (globalThis as { fetch?: unknown }).fetch === "undefined") {
  const fetchModule = require("node-fetch-native");
  const g = globalThis as any;
  g.fetch = fetchModule.default || fetchModule.fetch || fetchModule;
  if (fetchModule.Request) g.Request = fetchModule.Request;
  if (fetchModule.Response) g.Response = fetchModule.Response;
  if (fetchModule.Headers) g.Headers = fetchModule.Headers;
}

export {};
