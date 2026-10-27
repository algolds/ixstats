/**
 * Where map imports keep their files: the uploaded map (named by its SHA-256, so the same file is stored once and a
 * name can never reach outside the folder) and each analyse job's result. `MAP_IMPORT_DIR` when set, else
 * `.map-imports` under the app. Not served publicly (an admin's source map is not a public image). The web server
 * and the cron runner must see the same folder: on one host they share the app directory. Stored world bundles are
 * pruned by map-import.prune.ts. Server only.
 */
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { isGzip } from "~/lib/maps/import/world-bundle";
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

/**
 * Store an uploaded map; returns its id (the SHA-256 of its bytes). Storing the same bytes twice writes nothing, but
 * counts as storing it now (the file's time is renewed): the age of a stored world bundle is the time since its last
 * upload, which `listWorldBundleUploads` reports.
 */
export async function saveMapUpload(bytes: Uint8Array): Promise<string> {
  const uploadId = createHash("sha256").update(bytes).digest("hex");
  const file = uploadPath(uploadId);
  const exists = await stat(file).then(
    (s) => s.size === bytes.byteLength,
    () => false
  );
  if (exists) {
    const now = new Date();
    await utimes(file, now, now);
  } else {
    await writeAtomic(file, bytes);
  }
  return uploadId;
}

/** Whether a stored upload starts with the gzip header: a world bundle (the only gzip a map upload may be). */
async function startsWithGzip(file: string): Promise<boolean> {
  const handle = await open(file, "r");
  try {
    const head = new Uint8Array(3);
    const { bytesRead } = await handle.read(head, 0, 3, 0);
    return bytesRead === 3 && isGzip(head);
  } finally {
    await handle.close();
  }
}

/**
 * The stored world bundles (gzip uploads) and the time each was last stored, in ms. Only regular files in the uploads
 * folder whose name is an upload id: a link, a folder or any other name is not listed, so nothing outside is reachable.
 */
export async function listWorldBundleUploads(): Promise<
  Array<{ uploadId: string; storedAt: number }>
> {
  const base = await realpath(mapImportDir()).catch(() => null);
  const folder = base && path.join(base, "uploads");
  // An uploads folder that is a link to somewhere else is not this folder: nothing in it is ours to remove
  if (!folder || (await realpath(folder).catch(() => null)) !== folder) return [];
  const names = await readdir(folder).catch(() => [] as string[]);
  const found: Array<{ uploadId: string; storedAt: number }> = [];
  for (const uploadId of names.filter(isUploadId)) {
    const info = await lstat(uploadPath(uploadId)).catch(() => null);
    if (info?.isFile() && (await startsWithGzip(uploadPath(uploadId)))) {
      found.push({ uploadId, storedAt: info.mtimeMs });
    }
  }
  return found;
}

/** Remove a stored upload unless it was stored again after `olderThan` (ms): it may be a job's input by now. */
export async function removeMapUploadStoredBefore(uploadId: string, olderThan: number) {
  const file = uploadPath(uploadId);
  const info = await lstat(file).catch(() => null);
  if (!info?.isFile() || info.mtimeMs >= olderThan) return false;
  await rm(file, { force: true });
  return true;
}

/** The marker the throttle of the uploads pruning keeps: its time is the last pruning (shared by every process). */
export const PRUNE_MARKER = "uploads-pruned";

/** Whether `intervalMs` has passed since the last pruning; if so, the marker is renewed (the pruning is claimed). */
export async function claimUploadPrune(now: number, intervalMs: number): Promise<boolean> {
  const marker = path.join(mapImportDir(), PRUNE_MARKER);
  const last = await stat(marker).then(
    (s) => s.mtimeMs,
    () => 0
  );
  if (now - last < intervalMs) return false;
  await writeAtomic(marker, String(now));
  const at = new Date(now);
  await utimes(marker, at, at);
  return true;
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
