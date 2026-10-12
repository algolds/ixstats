/**
 * The browser side of the map import upload route (`/api/admin/map-import/upload`): one file in, the upload's id and
 * kind out. The import wizard sends a map file with it; the World tab sends the gzip world bundle.
 */
import { withBasePath } from "~/lib/base-path";
import type { GeojsonInspection } from "./geojson-engine";
import { MAX_MAP_IMPORT_BYTES, type MapImportKind } from "./options";

export interface MapUploadInfo {
  uploadId: string;
  kind: MapImportKind;
  filename: string;
  size: number;
  width: number | null;
  height: number | null;
  geojson?: GeojsonInspection;
}

/** An upload that failed. `status` is the route's HTTP status; null when the file was refused before it was sent. */
export class MapUploadError extends Error {
  constructor(
    message: string,
    readonly status: number | null
  ) {
    super(message);
    this.name = "MapUploadError";
  }
}

const MAX_MB = MAX_MAP_IMPORT_BYTES / 1024 / 1024;

/** Upload the file to the map import store; the server reads its kind from the bytes. */
export async function postMapUpload(realmId: string, file: File): Promise<MapUploadInfo> {
  if (file.size > MAX_MAP_IMPORT_BYTES) {
    throw new MapUploadError(`Map files are limited to ${MAX_MB} MB`, null);
  }
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(
    withBasePath(`/api/admin/map-import/upload?realm=${encodeURIComponent(realmId)}`),
    {
      method: "POST",
      body: form,
    }
  );
  const body = (await res
    .json()
    .catch(() => ({ error: `Upload failed (${res.status})` }))) as MapUploadInfo & {
    error?: string;
  };
  if (!res.ok) throw new MapUploadError(body.error ?? `Upload failed (${res.status})`, res.status);
  return body;
}

/** Upload a gzipped world bundle (`encodeWorldBundle`); the route checks it whole before it keeps it. */
export function uploadWorldBundle(
  realmId: string,
  bundle: Uint8Array<ArrayBuffer>
): Promise<MapUploadInfo> {
  return postMapUpload(realmId, new File([bundle], "world.json.gz", { type: "application/gzip" }));
}
