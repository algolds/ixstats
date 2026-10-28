/** @jest-environment node */
/**
 * The province importer reducer: steps past upload need a parsed file, the validation report lives only on the
 * review steps, busy/failed are one status that each outcome replaces, and reset returns to the start.
 */
import {
  importerReducer,
  initialImporterState,
  type ImporterAction,
  type ImporterState,
  type ParsedUpload,
} from "./importer-state";
import type { ConformanceResult } from "./topology";
import type { ProvinceFeature, TopologyReport } from "./types";

function province(sourceId: string): ProvinceFeature {
  return {
    sourceId,
    name: sourceId,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    },
    confidence: 1,
    centroid: [0.5, 0.5],
    bbox: [0, 0, 1, 1],
    areaSqKm: 1,
    included: true,
  };
}

const UPLOAD: ParsedUpload = {
  uploadId: "u1",
  rawSvgContent: "<svg/>",
  provinces: [province("a"), province("b")],
  countryBorder: null,
  parseLog: [],
  detectedLayers: [],
  cityData: { points: [{ svgX: 1, svgY: 2, name: "C", isCapital: true }], layers: [] },
};

const REPORT: TopologyReport = {
  valid: true,
  gaps: [],
  overlaps: [],
  coveragePercent: 100,
  totalProvincesArea: 2,
  countryArea: 2,
  featureIssues: [],
};

function run(...actions: ImporterAction[]): ImporterState {
  return actions.reduce(importerReducer, initialImporterState);
}

const parsed: ImporterAction = { type: "parsed", upload: UPLOAD };
const next = (clipped: ConformanceResult | null = null): ImporterAction => ({
  type: "advanced",
  clipped,
});

describe("importerReducer", () => {
  it("won't leave the upload step until a file is parsed", () => {
    expect(run(next()).wizard).toEqual({ step: "upload", session: null });
    expect(run({ type: "stepChanged", step: "commit" }).wizard.step).toBe("upload");
  });

  it("enters names on a parse, and steps forward and back keeping the session", () => {
    const state = run(parsed, next(), next());
    expect(state.wizard.step).toBe("snap");
    expect(state.wizard.session?.rawProvinces).toHaveLength(2);
    expect(state.settings.importCities).toBe(true);

    const back = run(parsed, next(), { type: "retreated" }, { type: "retreated" });
    expect(back.wizard.step).toBe("upload");
    // Next from upload returns to the parsed file without re-uploading
    expect(importerReducer(back, next()).wizard.step).toBe("names");
  });

  it("stores the snap-step clip and opens the notice only when something was clipped", () => {
    const clipped: ConformanceResult = {
      provinces: [province("a")],
      clippedIndices: [1],
      clippedNames: ["b"],
    };
    const atSnap = run(parsed, next(), next());
    const state = importerReducer(atSnap, next(clipped));
    expect(state.wizard.step).toBe("validate");
    expect(state.wizard.session?.alignedProvinces).toEqual([province("a")]);
    expect(state.wizard.session?.conformance).toEqual({ result: clipped, modalOpen: true });

    const closed = importerReducer(state, { type: "conformanceModalSet", open: false });
    expect(closed.wizard.session?.conformance?.modalOpen).toBe(false);
  });

  it("keeps the validation report on validate → commit and drops it when going back", () => {
    const validated = run(parsed, next(), next(), next(), { type: "validated", report: REPORT });
    expect(validated.wizard).toMatchObject({ step: "validate", validationReport: REPORT });
    expect(importerReducer(validated, next()).wizard).toMatchObject({
      step: "commit",
      validationReport: REPORT,
    });
    const back = importerReducer(validated, { type: "retreated" });
    expect(back.wizard.step).toBe("snap");
    expect("validationReport" in back.wizard).toBe(false);
    // A report arriving off the review steps is ignored
    expect(importerReducer(back, { type: "validated", report: REPORT })).toBe(back);
  });

  it("lets success and failure replace each other in the one status", () => {
    const busy = run({ type: "processingStarted" });
    expect(busy.status).toEqual({ kind: "processing" });

    const failed = importerReducer(busy, { type: "failed", message: "Upload failed" });
    expect(failed.status).toEqual({ kind: "error", message: "Upload failed" });

    const retried = importerReducer(failed, { type: "processingStarted" });
    expect(importerReducer(retried, parsed).status).toEqual({ kind: "idle" });
    expect(importerReducer(retried, { type: "processingFinished" }).status).toEqual({
      kind: "idle",
    });
  });

  it("clears an error on navigation but not a running operation", () => {
    const failed = run(parsed, { type: "failed", message: "x" }, next());
    expect(failed.status).toEqual({ kind: "idle" });

    const busy = run(parsed, { type: "processingStarted" }, { type: "stepChanged", step: "align" });
    expect(busy.status).toEqual({ kind: "processing" });
  });

  it("derives import-cities from the scope and the parsed file", () => {
    const state = run(parsed, { type: "scopeChanged", scope: "provinces" });
    expect(state.settings.importCities).toBe(false);
    expect(
      importerReducer(state, { type: "scopeChanged", scope: "both" }).settings.importCities
    ).toBe(true);
  });

  it("resets everything, settings included", () => {
    const state = run(
      parsed,
      next(),
      { type: "settingsChanged", patch: { snapTolerance: 0.5, replaceExisting: true } },
      { type: "failed", message: "x" },
      { type: "reset" }
    );
    expect(state).toEqual(initialImporterState);
  });
});
