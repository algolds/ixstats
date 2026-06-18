import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { worldMapProcedures } from "../world-map";

jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));

const mockDb = {
  mapStyleOverride: {
    findUnique: jest.fn() as any,
  },
};

const baseContext = {
  db: mockDb,
  user: null,
  auth: null,
  rateLimitIdentifier: "test",
  headers: new Headers(),
} as any;

const testRouter = createTRPCRouter({
  ...worldMapProcedures,
});

describe("getResolvedStyle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fall back to standard template styles when override is not present", async () => {
    mockDb.mapStyleOverride.findUnique.mockResolvedValue(null);

    const caller = createCallerFactory(testRouter)(baseContext);
    const resolved = await caller.getResolvedStyle({ theme: "standard" });

    expect(resolved).toBeDefined();
    expect(resolved.version).toBe(8);
    expect(resolved.glyphs).toContain("/fonts/");
    expect(typeof resolved.sources).toBe("object");
    expect(Array.isArray(resolved.layers)).toBe(true);

    // Verify placeholders are resolved
    const layersStr = JSON.stringify(resolved.layers);
    expect(layersStr).not.toContain("__FONT_REGULAR__");
    expect(layersStr).not.toContain("__FONT_BOLD__");
  });

  it("should return db style overrides when present", async () => {
    const mockStyle = {
      version: 8,
      name: "Custom Standard Theme",
      sources: {},
      layers: [
        {
          id: "custom-bg",
          type: "background",
          paint: { "background-color": "#ffffff" },
        },
      ],
    };

    mockDb.mapStyleOverride.findUnique.mockResolvedValue({
      id: "override-1",
      theme: "standard",
      styleJson: mockStyle,
    });

    const caller = createCallerFactory(testRouter)(baseContext);
    const resolved = await caller.getResolvedStyle({ theme: "standard" });

    expect(resolved).toBeDefined();
    expect(resolved.name).toBe("Custom Standard Theme");
    expect(resolved.glyphs).toContain("/fonts/");
    expect(resolved.layers).toHaveLength(1);
    expect(resolved.layers[0].id).toBe("custom-bg");
  });
});
