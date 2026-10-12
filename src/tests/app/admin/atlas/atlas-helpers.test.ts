import { formatBytes } from "~/app/admin/maps/_components/atlas/format";
import { jobLabel, summarizeResult } from "~/app/admin/maps/_components/atlas/job-labels";
import { DEFAULT_VIEW, viewRealms } from "~/app/admin/maps/_components/atlas/realms-view";
import { realmRow } from "~/tests/helpers/fake-atlas-ui";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [900, "900 B"],
    [1536, "1.5 KB"],
    [150 * 1024 * 1024, "150 MB"],
    [3.4 * 1024 ** 3, "3.4 GB"],
  ])("%d is %s", (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

describe("jobLabel", () => {
  it("names a job by what it does", () => {
    expect(jobLabel({ kind: "world", dryRun: true })).toBe("World check");
    expect(jobLabel({ kind: "world", dryRun: false })).toBe("World apply");
    expect(jobLabel({ kind: "map-pipeline", dryRun: false })).toBe("Map pipeline run");
    expect(jobLabel({ kind: "geojson", dryRun: true })).toBe("Analysis (GeoJSON)");
    expect(jobLabel({ kind: "svg", dryRun: false })).toBe("Apply (SVG)");
  });
});

describe("summarizeResult", () => {
  it("lists scalars as they are and lists and objects by size", () => {
    expect(
      summarizeResult({ written: 3, warningList: [1, 2], detail: { a: 1 }, nothing: null })
    ).toEqual([
      ["Written", "3"],
      ["Warning list", "2 items"],
      ["Detail", "1 fields"],
      ["Nothing", "None"],
    ]);
  });

  it("has nothing to say about a missing or scalar result", () => {
    expect(summarizeResult(null)).toEqual([]);
    expect(summarizeResult("done")).toEqual([]);
  });
});

describe("viewRealms", () => {
  const rows = [
    realmRow({ id: "1", name: "Zed", linkage: { linked: 1, total: 2 } }),
    realmRow({ id: "2", name: "Amy", linkage: { linked: 0, total: 0 } }),
    realmRow({ id: "3", name: "Bo", linkage: { linked: 3, total: 3 } }),
  ];

  it("sorts linkage by share, with a realm of no features as zero", () => {
    const view = { ...DEFAULT_VIEW, sort: { key: "linkage" as const, direction: "desc" as const } };
    expect(viewRealms(rows, view).map((row) => row.name)).toEqual(["Bo", "Zed", "Amy"]);
  });

  it("keeps the name order among ties", () => {
    const view = { ...DEFAULT_VIEW, sort: { key: "claims" as const, direction: "asc" as const } };
    expect(viewRealms(rows, view).map((row) => row.name)).toEqual(["Amy", "Bo", "Zed"]);
  });
});
