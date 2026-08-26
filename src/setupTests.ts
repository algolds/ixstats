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

// Polyfill Clerk publishable key for test env
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_mock_key_for_testing";

// Mock window.matchMedia for jsdom
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

jest.mock("@number-flow/react", () => {
  return {
    __esModule: true,
    default: ({ value }: { value: number }) => value,
  };
});



