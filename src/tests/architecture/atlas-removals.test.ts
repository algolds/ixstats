import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "../../..");

/** The old admin map tools and the editor sandbox, removed when Atlas replaced them. */
const REMOVED_FILES = [
  "src/app/admin/maps/WorldStudioPanel.tsx",
  "src/app/admin/maps/_components/PipelineWizard.tsx",
  "src/app/admin/maps/_components/LayeredSvgPipeline.tsx",
  "src/app/admin/maps/_components/SvgUploadManager.tsx",
  "src/app/admin/maps/_components/SvgProcessingDialog.tsx",
  "src/app/admin/maps/_components/SvgPreviewMap.tsx",
  "src/app/admin/maps/_components/MapSettingsTab.tsx",
  "src/app/admin/maps/_components/MapStatsDashboard.tsx",
  "src/app/admin/realms/_components/map-pipeline/MapPipelineTab.tsx",
  "src/components/maps/editor/panels/WorldCalibration.tsx",
  "src/lib/worldgen/world-calibration.ts",
  "src/lib/maps/map-pipeline.ts",
  "src/lib/flags/svg/layer-selection.ts",
  "src/lib/flags/svg/coordinate-calibration.ts",
  "src/lib/flags/svg/reference-geometry.ts",
  "src/lib/flags/svg/feature-extraction.ts",
];

/** Names that must no longer appear in any source file. */
const REMOVED_NAMES = [
  /\bWorldStudioPanel\b/,
  /\bPipelineWizard\b/,
  /\bLayeredSvgPipeline\b/,
  /\bSvgUploadManager\b/,
  /\bSvgProcessingDialog\b/,
  /\bSvgPreviewMap\b/,
  /\bMapSettingsTab\b/,
  /\bMapStatsDashboard\b/,
  /\bMapPipelineTab\b/,
  /\bWorldCalibration\b/,
  /world-calibration/,
  /\bWORLD_SANDBOX_HREF\b/,
  /\bisWorldSandbox\b/,
  /\bgetMapStats\b/,
  /\bgetLayerInfo\b/,
  /\b(?:processSvgUpload|previewSvgUpload|commitSvgUpload|rollbackSvgUpload|deleteSvgUpload|getSvgUploadHistory)\b/,
  /\bimportPipelineResult\b/,
  /api\/admin\/upload-svg/,
  // The Labs map pipeline reached its SVG and PNG converters through dynamic imports, which the removal grep missed
  /lib\/maps\/map-pipeline\b/,
  /\bparseSvgToGeoJson\b/,
  /\bconvertPngToSvg\b/,
];

const EDITOR_DIRS = ["src/components/maps/editor", "src/app/admin/maps/editor"];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const sources = walk(path.join(ROOT, "src")).filter(
  (file) =>
    !file.includes(`${path.sep}tests${path.sep}atlas-removals`) &&
    !file.endsWith("atlas-removals.test.ts")
);

describe("the old admin map tools are gone", () => {
  it.each(REMOVED_FILES)("%s does not exist", (file) => {
    expect(fs.existsSync(path.join(ROOT, file))).toBe(false);
  });

  it("no source file or test names a removed module or procedure", () => {
    const hits = sources.flatMap((file) => {
      const text = fs.readFileSync(file, "utf8");
      return REMOVED_NAMES.filter((name) => name.test(text)).map(
        (name) => `${path.relative(ROOT, file)}: ${name}`
      );
    });
    expect(hits).toEqual([]);
  });
});

describe("the editor has no sandbox", () => {
  it("names no sandbox in the map editor or its page", () => {
    const hits = EDITOR_DIRS.flatMap((dir) => walk(path.join(ROOT, dir))).filter((file) =>
      /sandbox/i.test(fs.readFileSync(file, "utf8"))
    );
    expect(hits.map((file) => path.relative(ROOT, file))).toEqual([]);
  });
});
