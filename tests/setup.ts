import "@testing-library/jest-dom";
import fetch, { Headers, Request, Response } from "node-fetch-native";

// Polyfill fetch and its helpers for testing environments (e.g. Clerk nextjs/server)
if (typeof global.fetch === "undefined") {
  global.fetch = fetch as any;
  global.Headers = Headers as any;
  global.Request = Request as any;
  global.Response = Response as any;
}

// Note: ~/env mock is handled via moduleNameMapper in jest config
// This avoids circular require issues

// Mock next/navigation for components that use routing
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useParams: () => ({}),
}));

// Browser-specific mocks only if window is defined (jsdom environment)
if (typeof window !== "undefined") {
  // Mock window.matchMedia for components using media queries
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
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

// Mock ResizeObserver for components using it (works in both environments)
if (typeof global.ResizeObserver === "undefined") {
  global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
}

// Mock IntersectionObserver for lazy loading components
if (typeof global.IntersectionObserver === "undefined") {
  global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  }));
}

export {};
