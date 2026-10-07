/**
 * Reads one file of a realm's source repository. Only raw.githubusercontent.com, only a validated `owner/repo`,
 * ref and relative path, never a redirect, with a timeout and a size cap, so a misconfigured or hostile source
 * cannot point the server at another host or stream it an unbounded body.
 */
import { refSchema, repoPathSchema, repoSchema } from "./config";

export const RAW_GITHUB_HOST = "raw.githubusercontent.com";
/** The largest file a run reads. */
export const MAX_SOURCE_FILE_BYTES = 5 * 1024 * 1024;
export const SOURCE_FETCH_TIMEOUT_MS = 20_000;

export class SourceFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceFetchError";
  }
}

export interface RepoFileRef {
  repo: string;
  ref: string;
  path: string;
}

interface FetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

/** The raw URL of a repository file, after validating every part. Throws SourceFetchError on a bad part. */
export function rawGithubUrl({ repo, ref, path }: RepoFileRef): URL {
  const parts = [repoSchema.safeParse(repo), refSchema.safeParse(ref), repoPathSchema.safeParse(path)];
  const bad = parts.find((part) => !part.success);
  if (bad && !bad.success) throw new SourceFetchError(bad.error.issues[0]?.message ?? "Bad source");
  const encodedRef = ref.trim().split("/").map(encodeURIComponent).join("/");
  const encodedPath = path.trim().split("/").map(encodeURIComponent).join("/");
  const url = new URL(`https://${RAW_GITHUB_HOST}/${repo.trim()}/${encodedRef}/${encodedPath}`);
  if (url.hostname !== RAW_GITHUB_HOST || url.protocol !== "https:")
    throw new SourceFetchError("Sources are read from raw.githubusercontent.com only");
  return url;
}

async function readCapped(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? Number.NaN);
  if (Number.isFinite(declared) && declared > maxBytes)
    throw new SourceFetchError(`File is larger than ${maxBytes} bytes`);
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new SourceFetchError(`File is larger than ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8").decode(bytes);
}

/** The text of one repository file. Throws SourceFetchError on any refusal, HTTP error, redirect or timeout. */
export async function fetchRepoFile(file: RepoFileRef, options: FetchOptions = {}): Promise<string> {
  const url = rawGithubUrl(file);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? SOURCE_FETCH_TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(url.toString(), {
      redirect: "manual",
      signal: controller.signal,
      headers: { Accept: "text/plain, application/json;q=0.9, */*;q=0.1" },
    });
    if (response.status >= 300 && response.status < 400)
      throw new SourceFetchError(`${file.path}: the source redirected; redirects are not followed`);
    if (response.type === "opaqueredirect")
      throw new SourceFetchError(`${file.path}: the source redirected; redirects are not followed`);
    if (!response.ok) throw new SourceFetchError(`${file.path}: HTTP ${response.status}`);
    return await readCapped(response, options.maxBytes ?? MAX_SOURCE_FILE_BYTES);
  } catch (error) {
    if (error instanceof SourceFetchError) throw error;
    if (controller.signal.aborted) throw new SourceFetchError(`${file.path}: timed out`);
    throw new SourceFetchError(`${file.path}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }
}
