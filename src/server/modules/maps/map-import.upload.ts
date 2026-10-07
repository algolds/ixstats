/**
 * An uploaded map file: what kind it is (from its bytes, not its name), what the wizard needs to know about it
 * before an import (an image's size, an SVG's viewBox, a GeoJSON's properties and coordinate space), and its id in
 * the map import store.
 */
import type { MapImportKind } from "~/lib/maps/import/options";
import { inspectGeojson, type GeojsonInspection } from "~/lib/maps/import/geojson-engine";
import { MapImportError } from "./map-import.realm";
import { saveMapUpload } from "./map-import.storage";

export interface MapUploadInfo {
  uploadId: string;
  kind: MapImportKind;
  filename: string;
  size: number;
  /** Image pixels or SVG viewBox units (null for lon/lat GeoJSON). */
  width: number | null;
  height: number | null;
  geojson?: GeojsonInspection;
}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((b, i) => bytes[offset + i] === b);

/** The kind of a map file from its first bytes: a raster image, an SVG drawing or GeoJSON; null otherwise. */
export function sniffMapKind(bytes: Uint8Array): MapImportKind | null {
  if (
    startsWith(bytes, [0x89, 0x50, 0x4e, 0x47]) || // PNG
    startsWith(bytes, [0xff, 0xd8, 0xff]) || // JPEG
    (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) // WebP
  ) {
    return "png";
  }
  const head = new TextDecoder("utf-8").decode(bytes.subarray(0, 4096)).replace(/^﻿/, "").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return "svg";
  if (head.startsWith("{")) return "geojson";
  return null;
}

function svgSize(text: string): { width: number | null; height: number | null } {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0] ?? "";
  const viewBox = /viewBox\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.split(/[\s,]+/).map(Number);
  if (viewBox && viewBox.length >= 4 && viewBox[2]! > 0 && viewBox[3]! > 0) {
    return { width: viewBox[2]!, height: viewBox[3]! };
  }
  const attr = (name: string) => parseFloat(new RegExp(`\\b${name}\\s*=\\s*["']([\\d.]+)`, "i").exec(tag)?.[1] ?? "");
  const width = attr("width");
  const height = attr("height");
  return width > 0 && height > 0 ? { width, height } : { width: null, height: null };
}

/** Check, describe and store an uploaded map file. Unreadable files are refused with the reason. */
export async function acceptMapUpload(bytes: Uint8Array, filename: string): Promise<MapUploadInfo> {
  const kind = sniffMapKind(bytes);
  if (!kind) {
    throw new MapImportError("BAD_REQUEST", "Upload a PNG, JPEG or WebP image, an SVG drawing or a GeoJSON file");
  }
  let width: number | null = null;
  let height: number | null = null;
  let geojson: GeojsonInspection | undefined;
  try {
    if (kind === "png") {
      const { imageDimensions } = await import("~/lib/maps/import/png/decode");
      ({ width, height } = await imageDimensions(bytes));
    } else {
      const text = new TextDecoder("utf-8").decode(bytes);
      if (kind === "svg") ({ width, height } = svgSize(text));
      else {
        geojson = inspectGeojson(text);
        if (geojson.space === "pixel") {
          width = Math.ceil(geojson.bbox[2]);
          height = Math.ceil(geojson.bbox[3]);
        }
      }
    }
  } catch (error) {
    throw new MapImportError("BAD_REQUEST", error instanceof Error ? error.message : String(error));
  }
  const uploadId = await saveMapUpload(bytes);
  return { uploadId, kind, filename: filename.slice(0, 200), size: bytes.byteLength, width, height, geojson };
}
