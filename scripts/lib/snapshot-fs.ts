/** The real disk behind the XenForo snapshot's injected `SnapshotFs` (export and import runners). */
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import type { SnapshotFs } from "~/lib/thinkpages-forum/import/snapshot";

export const snapshotDiskFs: SnapshotFs = {
  readFile: (file) => readFile(file, "utf8"),
  writeFile: (file, data) => writeFile(file, data),
  appendFile: (file, data) => appendFile(file, data, "utf8"),
  rename: (from, to) => rename(from, to),
  mkdir: async (dir) => {
    await mkdir(dir, { recursive: true });
  },
  exists: async (file) => existsSync(file),
  stat: async (file) => ({ size: (await stat(file)).size }),
};
