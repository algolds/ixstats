/** @jest-environment node */
// `jest` is the injected global on purpose: @swc/jest only hoists jest.mock() on the global.
jest.mock("~/env", () => ({ env: { DATABASE_URL: "file:./test.db", NODE_ENV: "test" } }));
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/maps/map-pipeline", () => ({
  runMapPipeline: jest.fn(),
  validatePipelineResult: jest.fn(() => ({ valid: true, errors: [] })),
}));

import { createCallerFactory } from "~/server/api/trpc";
import { geoEditorProceduralRouter } from "~/server/api/routers/geo/editor/procedural";
import { runMapPipeline } from "~/lib/maps/map-pipeline";
import { MAX_PNG_BASE64_LENGTH } from "~/lib/maps/png-realm-map";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const runMock = runMapPipeline as jest.Mock;

/** Every model answers empty; the admin middleware only needs the context's user. */
function emptyDb() {
  const model = () =>
    new Proxy({} as Record<string, jest.Mock>, {
      get: (target, name) => (target[String(name)] ??= jest.fn().mockResolvedValue(null)),
    });
  const models = new Map<string, Record<string, jest.Mock>>();
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, name) => {
      const key = String(name);
      if (!models.has(key)) models.set(key, model());
      return models.get(key);
    },
  });
}

function caller() {
  return createCallerFactory(geoEditorProceduralRouter)(
    createMockRouterContext({
      db: emptyDb(),
      auth: { userId: "admin_1" },
      user: {
        id: "db_admin",
        clerkUserId: "admin_1",
        role: { name: "admin", level: 10 },
        country: null,
      },
    }) as never
  );
}

const pipelineResult = {
  layers: { political: { type: "FeatureCollection", features: [] } },
  metadata: { source: "svg", featureCounts: {}, coordinateSystem: null, log: [], warnings: [] },
  detectedColors: [{ hex: "#ff0000", pixelCount: 40, featureId: "country_0" }],
};

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

beforeEach(() => {
  runMock.mockReset();
  runMock.mockResolvedValue(pipelineResult);
});

describe("geoEditor.runPipeline — PNG input", () => {
  it("decodes the base64 PNG and forwards it, auto-detecting colours when no mapping is given", async () => {
    const result = await caller().runPipeline({
      source: "png",
      pngBase64: PNG_BYTES.toString("base64"),
      pngConfig: { backgroundColor: "#0000ff", minRegionSize: 50, smoothing: 0.5 },
    });

    expect(runMock).toHaveBeenCalledTimes(1);
    const input = runMock.mock.calls[0][0];
    expect(input.source).toBe("png");
    expect(Buffer.isBuffer(input.pngBuffer)).toBe(true);
    expect(input.pngBuffer.equals(PNG_BYTES)).toBe(true);
    expect(input.pngConfig).toEqual({
      autoDetectColors: true,
      backgroundColor: "#0000ff",
      minRegionSize: 50,
      smoothing: 0.5,
    });
    expect(result.detectedColors).toEqual(pipelineResult.detectedColors);
    expect(result.validation).toEqual({ valid: true, errors: [] });
  });

  it("forwards the colour → nation mapping and stops auto-detection", async () => {
    await caller().runPipeline({
      source: "png",
      pngBase64: PNG_BYTES.toString("base64"),
      pngConfig: { colorMapping: { "#ff0000": "Aurelia", "#00FF00": "Trinidad & Tobago" } },
    });

    expect(runMock.mock.calls[0][0].pngConfig).toEqual({
      autoDetectColors: false,
      colorMapping: { "#ff0000": "Aurelia", "#00FF00": "Trinidad & Tobago" },
    });
  });

  it("rejects a PNG over the size limit with BAD_REQUEST before running the pipeline", async () => {
    await expect(
      caller().runPipeline({ source: "png", pngBase64: "A".repeat(MAX_PNG_BASE64_LENGTH + 4) })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(runMock).not.toHaveBeenCalled();
  });

  it("rejects PNG input without image data, and malformed colours or base64", async () => {
    const png = caller();
    await expect(png.runPipeline({ source: "png" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      png.runPipeline({ source: "png", pngBase64: "data:image/png;base64,AAAA" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      png.runPipeline({
        source: "png",
        pngBase64: "AAAA",
        pngConfig: { colorMapping: { red: "Aurelia" } },
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(runMock).not.toHaveBeenCalled();
  });
});

describe("geoEditor.runPipeline — SVG and procedural input are unchanged", () => {
  it("forwards SVG content as before, with no PNG fields", async () => {
    await caller().runPipeline({
      source: "svg",
      svgContent: "<svg/>",
      targetLayers: ["political"],
    });
    expect(runMock).toHaveBeenCalledWith({
      source: "svg",
      svgContent: "<svg/>",
      worldGenParams: undefined,
      targetLayers: ["political"],
    });
  });

  it("forwards procedural parameters as before", async () => {
    await caller().runPipeline({ source: "procedural", worldGenParams: { seed: 7 } });
    expect(runMock).toHaveBeenCalledWith({
      source: "procedural",
      svgContent: undefined,
      worldGenParams: { seed: 7 },
      targetLayers: undefined,
    });
  });
});
