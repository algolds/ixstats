/**
 * A realm's map art by key (`pipeline.art`, realm-map-art.ts) as bytes, for one pipeline run:
 *
 * - `{ repoPath }`: the file of the realm's source-sync repository at its ref, read from raw.githubusercontent.com
 *   (fetchRepoBytes: no redirects, a timeout, at most MAX_ART_FILE_BYTES), then kept in the map import store under
 *   its SHA-256 like an upload; or, from the CLI with `--source <dir>`, the file in that local checkout (the path
 *   checked to stay inside it). The checkout is data: nothing in it is ever run.
 * - `{ uploadId }`: the file uploaded through `/api/admin/map-import/upload` (MAP_IMPORT_DIR).
 *
 * Each key is read once per run however many steps use it. Server only.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ArtSource } from "~/lib/maps/realm-map-art";
import { fetchRepoBytes, MAX_ART_FILE_BYTES, type RepoFileRef } from "~/lib/realms/sources/fetch";
import { mapUploadSize, readMapUpload, saveMapUpload } from "./map-import.storage";

interface ResolvedArt {
  bytes: Uint8Array;
  /** SHA-256 of the bytes (hex): what the run read, for its report. */
  sha256: string;
}

interface ArtResolverInput {
  art: Readonly<Record<string, ArtSource>>;
  /** The realm's source-sync repository and ref; null when it has none. */
  repo: { repo: string; ref: string } | null;
  /** A local checkout of the repository: repository art is read from it instead (the CLI's `--source`). */
  localDir?: string;
  fetchBytes?: typeof fetchRepoBytes;
}

export type ArtResolver = (key: string) => Promise<ResolvedArt>;

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** A file of a local checkout; refused when the path would leave the checkout. */
async function readLocal(dir: string, repoPath: string): Promise<Uint8Array> {
  const root = path.resolve(dir);
  const file = path.resolve(root, repoPath);
  const inside = path.relative(root, file);
  if (inside.startsWith("..") || path.isAbsolute(inside)) {
    throw new Error(`${repoPath} is outside the checkout`);
  }
  return new Uint8Array(await readFile(file));
}

/** A fetchRepoFile that reads a local checkout instead (the CLI's `--source`; repository and ref ignored). */
export function localRepoFile(dir: string) {
  return async (file: RepoFileRef): Promise<string> =>
    new TextDecoder("utf-8").decode(await readLocal(dir, file.path));
}

async function readUpload(uploadId: string): Promise<ResolvedArt> {
  if ((await mapUploadSize(uploadId)) === null) {
    throw new Error("the uploaded file is gone from the map import store: upload it again");
  }
  return { bytes: await readMapUpload(uploadId), sha256: uploadId };
}

async function readRepoFile(input: ArtResolverInput, repoPath: string): Promise<ResolvedArt> {
  if (input.localDir) {
    const bytes = await readLocal(input.localDir, repoPath);
    return { bytes, sha256: sha256(bytes) };
  }
  if (!input.repo) {
    throw new Error("it is a repository file, but the realm has no source repository");
  }
  const bytes = await (input.fetchBytes ?? fetchRepoBytes)(
    { ...input.repo, path: repoPath },
    { maxBytes: MAX_ART_FILE_BYTES, timeoutMs: 120_000 }
  );
  return { bytes, sha256: await saveMapUpload(bytes) };
}

/** Reads each key's art once; an unknown key or an unreadable file fails with the key in the message. */
export function artResolver(input: ArtResolverInput): ArtResolver {
  const read = new Map<string, Promise<ResolvedArt>>();
  return (key) => {
    const cached = read.get(key);
    if (cached) return cached;
    const source = Object.hasOwn(input.art, key) ? input.art[key] : undefined;
    const pending = (async () => {
      if (!source) throw new Error(`No art named "${key}"`);
      try {
        return "uploadId" in source
          ? await readUpload(source.uploadId)
          : await readRepoFile(input, source.repoPath);
      } catch (error) {
        throw new Error(`Art "${key}": ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        });
      }
    })();
    read.set(key, pending);
    return pending;
  };
}

/** The art's text (a data file: a climate key, a label list). */
export async function artText(resolve: ArtResolver, key: string): Promise<string> {
  return new TextDecoder("utf-8").decode((await resolve(key)).bytes);
}
