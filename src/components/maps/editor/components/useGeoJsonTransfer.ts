import { useCallback } from "react";
import { useNotify } from "~/hooks/useNotify";
import { featuresToGeoJSON } from "~/hooks/map-editor/editor-geo-ops";
import type { MapEditorInstance } from "../types/editor-state";

const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

/** Export the editor's features as a GeoJSON download, and import a GeoJSON file as new features. */
export function useGeoJsonTransfer(editor: MapEditorInstance, mapName: string | undefined) {
  const notify = useNotify();

  const exportGeoJSON = useCallback(() => {
    const fc = featuresToGeoJSON(editor.allFeatures);
    if (fc.features.length === 0) {
      notify.info("Nothing to export", "This map has no features yet.");
      return;
    }
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (mapName ?? "map").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    a.href = url;
    a.download = `${slug}-features.geojson`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify.success("GeoJSON exported", `${fc.features.length} features`);
  }, [editor.allFeatures, mapName, notify]);

  const importGeoJSON = useCallback(
    async (file: File) => {
      if (file.size > MAX_IMPORT_BYTES) {
        notify.error("File too large", "GeoJSON imports are limited to 20 MB.");
        return;
      }
      try {
        const doc: unknown = JSON.parse(await file.text());
        const result = await editor.importGeoJSON(doc);
        if (result.created === 0) {
          notify.warning(
            "Nothing imported",
            result.skipped > 0
              ? `${result.skipped} features were not points or polygons.`
              : "The file had no features."
          );
          return;
        }
        notify.success(
          `Imported ${result.created} feature${result.created === 1 ? "" : "s"}`,
          [
            result.skipped ? `${result.skipped} skipped (lines/unsupported)` : null,
            result.failed ? `${result.failed} rejected by the server` : null,
            "Undo (Ctrl+Z) removes the whole import.",
          ]
            .filter(Boolean)
            .join(" · ")
        );
      } catch (e) {
        notify.error("Import failed", e instanceof Error ? e.message : "Not a valid GeoJSON file");
      }
    },
    [editor, notify]
  );

  return { exportGeoJSON, importGeoJSON };
}
