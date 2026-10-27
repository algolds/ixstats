/**
 * upload-staging.ts — where WikiOS keeps an uploaded file until MediaWiki holds it too (plan 411).
 *
 * An upload is written to `<WIKIOS_UPLOAD_DIR>/<sha1>` (the base-36 content hash, so a name can never reach outside
 * the directory) and served from there at once; the `upload` mirror job (mirror-upload.ts) then uploads the same
 * bytes to MediaWiki and the staged copy is released. The write is atomic (a temporary file in the same directory,
 * then a rename), so a reader never sees half a file, and two uploads of the same bytes share one file.
 */

import { randomBytes } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { getUploadDir } from "~/lib/wiki-os/config";
import { isFileHash } from "../core/file-hash";

function pathOf(sha1: string): string {
  if (!isFileHash(sha1)) throw new Error(`"${sha1}" is not a file hash`);
  return `${getUploadDir()}/${sha1}`;
}

/** Whether the staged copy of `sha1` is there. */
export async function isStaged(sha1: string): Promise<boolean> {
  return stat(pathOf(sha1)).then(
    (file) => file.isFile(),
    () => false
  );
}

/** Keep `bytes` (whose hash is `sha1`) in the staging directory; one that is there already is not written again. */
export async function stageBytes(sha1: string, bytes: Uint8Array): Promise<void> {
  const target = pathOf(sha1);
  if (await isStaged(sha1)) return;
  await mkdir(getUploadDir(), { recursive: true });
  const temporary = `${target}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, bytes, { mode: 0o640 });
    await rename(temporary, target);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

/** The staged bytes of `sha1`, or null when WikiOS holds no such file (it was never staged, or MediaWiki has it and the copy was released). */
export async function readStaged(sha1: string): Promise<Buffer | null> {
  return readFile(pathOf(sha1)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}

/** Delete the staged copy of `sha1`; nothing happens when it is not there. */
export async function releaseStaged(sha1: string): Promise<void> {
  await rm(pathOf(sha1), { force: true });
}

/** The staged files (hash-named) and when each was last written; an empty list when nothing was ever staged. */
export async function listStaged(): Promise<Array<{ sha1: string; modifiedAt: Date }>> {
  const names = await readdir(getUploadDir()).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const staged = await Promise.all(
    names.filter(isFileHash).map(async (sha1) => {
      const file = await stat(pathOf(sha1)).catch(() => null);
      return file?.isFile() ? { sha1, modifiedAt: file.mtime } : null;
    })
  );
  return staged.filter((entry) => entry !== null);
}

/**
 * Delete the temporary files of writes that never finished (a crash between `writeFile` and `rename`) that are older than
 * `before`; resolves to how many. A live write takes seconds, so a day-old one is dead.
 */
export async function removeStaleTemporaries(before: Date): Promise<number> {
  const names = await readdir(getUploadDir()).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  let removed = 0;
  for (const name of names.filter((entry) => entry.endsWith(".tmp"))) {
    const file = await stat(`${getUploadDir()}/${name}`).catch(() => null);
    if (file?.isFile() && file.mtime < before) {
      await rm(`${getUploadDir()}/${name}`, { force: true });
      removed++;
    }
  }
  return removed;
}
