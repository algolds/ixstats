/**
 * An in-memory `SnapshotFs` for the XenForo export tests: files are strings or bytes keyed by path, and every
 * mutating call is logged ("writeFile <path>", "appendFile <path>", "rename <from> <to>") so a test can assert the
 * order of writes (state.json only ever lands by rename).
 */
import type { SnapshotFs } from "~/lib/thinkpages-forum/import/snapshot";

export interface MemorySnapshotFs extends SnapshotFs {
  files: Map<string, string | Uint8Array>;
  ops: string[];
  text: (file: string) => string;
}

function sizeOf(data: string | Uint8Array): number {
  return typeof data === "string" ? Buffer.byteLength(data) : data.byteLength;
}

export function createMemorySnapshotFs(): MemorySnapshotFs {
  const files = new Map<string, string | Uint8Array>();
  const dirs = new Set<string>();
  const ops: string[] = [];
  const read = (file: string): string | Uint8Array => {
    const data = files.get(file);
    if (data === undefined) throw new Error(`ENOENT: ${file}`);
    return data;
  };
  const text = (file: string): string => {
    const data = read(file);
    return typeof data === "string" ? data : Buffer.from(data).toString("utf8");
  };
  return {
    files,
    ops,
    text,
    readFile: async (file) => text(file),
    writeFile: async (file, data) => {
      ops.push(`writeFile ${file}`);
      files.set(file, data);
    },
    appendFile: async (file, data) => {
      ops.push(`appendFile ${file}`);
      files.set(file, (files.has(file) ? text(file) : "") + data);
    },
    rename: async (from, to) => {
      ops.push(`rename ${from} ${to}`);
      files.set(to, read(from));
      files.delete(from);
    },
    mkdir: async (dir) => {
      dirs.add(dir);
    },
    exists: async (file) => files.has(file) || dirs.has(file),
    stat: async (file) => ({ size: sizeOf(read(file)) }),
    readLines: async function* (file) {
      yield* text(file).split("\n");
    },
  };
}
