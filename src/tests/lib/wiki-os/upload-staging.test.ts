/** @jest-environment node */
/**
 * Plan 411: the staging directory keeps an upload under its content hash, written atomically, and a hash is the
 * only thing that can name a file in it. The hash helpers agree with MediaWiki's two forms of the same SHA-1.
 */
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashFile, isFileHash, sha1Base36ToHex } from "~/lib/wiki-os/core/file-hash";
import { sha1HexToBase36 } from "~/lib/wiki-os/xml/sha1";
import {
  isStaged,
  readStaged,
  releaseStaged,
  stageBytes,
} from "~/lib/wiki-os/services/upload-staging";

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "wikios-staging-test-"));
  process.env.WIKIOS_UPLOAD_DIR = directory;
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  delete process.env.WIKIOS_UPLOAD_DIR;
});

describe("file hashes", () => {
  it("are MediaWiki's SHA-1 in both of its forms", () => {
    // the SHA-1 of the empty input
    const empty = hashFile(new Uint8Array(0));
    expect(empty.hex).toBe("da39a3ee5e6b4b0d3255bfef95601890afd80709");
    expect(empty.base36).toBe(sha1HexToBase36(empty.hex));
    expect(empty.base36).toHaveLength(31);
    expect(sha1Base36ToHex(empty.base36)).toBe(empty.hex);
  });

  it("round-trip for a hash that starts with zeros", () => {
    const hex = "00000000000000000000000000000000000000ff";
    expect(sha1Base36ToHex(sha1HexToBase36(hex))).toBe(hex);
  });

  it("only a 31-character base-36 string names a staged file", () => {
    expect(isFileHash(hashFile(new Uint8Array([1])).base36)).toBe(true);
    for (const bad of [
      "",
      "../etc/passwd",
      "a".repeat(30),
      "a".repeat(32),
      "A".repeat(31),
      `${"a".repeat(30)}/`,
    ]) {
      expect(isFileHash(bad)).toBe(false);
    }
  });
});

describe("the staging directory", () => {
  const bytes = Uint8Array.from([1, 2, 3, 250]);
  const { base36 } = hashFile(bytes);

  it("keeps the bytes under their hash and hands them back", async () => {
    expect(await isStaged(base36)).toBe(false);
    expect(await readStaged(base36)).toBeNull();

    await stageBytes(base36, bytes);

    expect(await isStaged(base36)).toBe(true);
    expect(await readStaged(base36)).toEqual(Buffer.from(bytes));
    expect(readdirSync(directory)).toEqual([base36]);
  });

  it("creates the directory when it is not there yet", async () => {
    rmSync(directory, { recursive: true });

    await stageBytes(base36, bytes);

    expect(await isStaged(base36)).toBe(true);
  });

  it("does not write the same bytes twice", async () => {
    await stageBytes(base36, bytes);
    writeFileSync(join(directory, base36), "sentinel");

    await stageBytes(base36, bytes);

    expect((await readStaged(base36))?.toString()).toBe("sentinel");
  });

  it("releases a copy, and releasing one that is gone is fine", async () => {
    await stageBytes(base36, bytes);

    await releaseStaged(base36);
    await releaseStaged(base36);

    expect(await isStaged(base36)).toBe(false);
    expect(readdirSync(directory)).toEqual([]);
  });

  it("refuses a name that is not a hash", async () => {
    await expect(stageBytes("../outside", bytes)).rejects.toThrow("not a file hash");
    await expect(readStaged("../outside")).rejects.toThrow("not a file hash");
    await expect(releaseStaged("a/b")).rejects.toThrow("not a file hash");
  });
});
