/**
 * Where map imports keep their files: the uploaded map (named by its SHA-256, so the same file is stored once and a
 * name can never reach outside the folder) and each analyse job's result. `MAP_IMPORT_DIR` when set, else
 * `.map-imports` under the app. Not served publicly (an admin's source map is not a public image). The web server
 * and the cron runner must see the same folder: on one host they share the app directory. Server only.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EngineResult } from "~/lib/maps/import/options";

const UPLOAD_ID = /^[0-9a-f]{64}$/;
const JOB_ID = /^[a-z0-9]{8,40}$/i;

export function mapImportDir(): string {
  return (
    process.env.MAP_IMPORT_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), ".map-imports")
  );
}

export const isUploadId = (id: string) => UPLOAD_ID.test(id);

function uploadPath(uploadId: string): string {
  if (!isUploadId(uploadId)) throw new Error("Not a map upload id");
  return path.join(mapImportDir(), "uploads", uploadId);
}

function resultPath(jobId: string): string {
  if (!JOB_ID.test(jobId)) throw new Error("Not a map import job id");
  return path.join(mapImportDir(), "results", `${jobId}.json`);
}

async function writeAtomic(file: string, data: Uint8Array | string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, data);
  await rename(temporary, file);
}

/** Store an uploaded map; returns its id (the SHA-256 of its bytes). Storing the same bytes twice is a no-op. */
export async function saveMapUpload(bytes: Uint8Array): Promise<string> {
  const uploadId = createHash("sha256").update(bytes).digest("hex");
  const file = uploadPath(uploadId);
  const exists = await stat(file).then(
    (s) => s.size === bytes.byteLength,
    () => false
  );
  if (!exists) await writeAtomic(file, bytes);
  return uploadId;
}

export async function mapUploadSize(uploadId: string): Promise<number | null> {
  return stat(uploadPath(uploadId)).then(
    (s) => s.size,
    () => null
  );
}

export async function readMapUpload(uploadId: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(uploadPath(uploadId)));
}

export async function saveImportResult(jobId: string, result: EngineResult): Promise<void> {
  await writeAtomic(resultPath(jobId), JSON.stringify(result));
}

export async function readImportResult(jobId: string): Promise<EngineResult> {
  return JSON.parse(await readFile(resultPath(jobId), "utf8")) as EngineResult;
}
