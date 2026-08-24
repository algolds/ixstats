/**
 * @jest-environment node
 */
import { getBasePath, withBasePath } from "~/lib/base-path";

describe("Dynamic Base Path Resolution", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    if (typeof jest !== "undefined" && typeof jest.resetModules === "function") {
      jest.resetModules();
    }
    // Restore process.env to its original state
    for (const key in process.env) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const key in originalEnv) {
      process.env[key] = originalEnv[key];
    }
    // Make sure window is undefined by default
    delete (global as any).window;
  });

  afterAll(() => {
    // Restore env
    for (const key in process.env) {
      if (!(key in originalEnv)) {
        delete process.env[key];
      }
    }
    for (const key in originalEnv) {
      process.env[key] = originalEnv[key];
    }
    // Clean up window
    delete (global as any).window;
  });

  test("should resolve to empty base path when building/running for IxWorld Standalone", () => {
    process.env.NEXT_PUBLIC_IXWORLD_STANDALONE = "true";
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    process.env.BASE_PATH = "/projects/ixstates";

    expect(getBasePath()).toBe("");
    expect(withBasePath("/vault/marketplace")).toBe("/vault/marketplace");
  });

  test("should resolve to default production base path on server-side when NEXT_PUBLIC_IXWORLD_STANDALONE is not set", () => {
    delete process.env.NEXT_PUBLIC_IXWORLD_STANDALONE;
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    process.env.BASE_PATH = "/projects/ixstates";

    expect(getBasePath()).toBe("/projects/ixstates");
    expect(withBasePath("/vault/marketplace")).toBe("/projects/ixstates/vault/marketplace");
  });

  test("should dynamically respect other configured base paths (e.g. projects/ixstats) on server-side", () => {
    delete process.env.NEXT_PUBLIC_IXWORLD_STANDALONE;
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstats";
    process.env.BASE_PATH = "/projects/ixstats";

    expect(getBasePath()).toBe("/projects/ixstats");
    expect(withBasePath("/vault/marketplace")).toBe("/projects/ixstats/vault/marketplace");
  });

  test("should resolve with base path on client-side when browser is on the subpath", () => {
    delete process.env.NEXT_PUBLIC_IXWORLD_STANDALONE;
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    process.env.BASE_PATH = "/projects/ixstates";

    // Mock global window object with browser properties
    (global as any).window = {
      location: {
        pathname: "/projects/ixstates/vault/marketplace",
        hostname: "localhost",
      },
    };

    expect(getBasePath()).toBe("/projects/ixstates");
    expect(withBasePath("/vault/marketplace")).toBe("/projects/ixstates/vault/marketplace");
  });

  test("should not prepend base path on client-side when browser is at root (e.g. dev mode)", () => {
    delete process.env.NEXT_PUBLIC_IXWORLD_STANDALONE;
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    process.env.BASE_PATH = "/projects/ixstates";

    // Mock global window object with root pathname
    (global as any).window = {
      location: {
        pathname: "/vault/marketplace",
        hostname: "localhost",
      },
    };

    expect(getBasePath()).toBe("/projects/ixstates");
    expect(withBasePath("/vault/marketplace")).toBe("/vault/marketplace");
  });
});
