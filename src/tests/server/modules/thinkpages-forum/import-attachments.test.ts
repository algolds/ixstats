/** @jest-environment node */
import { createHash } from "crypto";
import path from "path";

jest.mock("~/server/shared/uploaded-assets", () => ({ registerUploadedAsset: jest.fn() }));

import { ATTACHMENT_URL_PREFIX } from "~/lib/thinkpages-forum/import/attachments";
import type { AttachmentEntry } from "~/lib/thinkpages-forum/import/snapshot";
import type { XfNode, XfPost, XfThread } from "~/lib/thinkpages-forum/import/xenforo-types";
import {
  copyAttachments,
  planAttachmentCopies,
  type AttachmentFs,
  type AttachmentSnapshot,
} from "~/server/modules/thinkpages-forum/import-attachments";
import { registerUploadedAsset } from "~/server/shared/uploaded-assets";
import { UPLOADS_URL_PREFIX } from "~/server/shared/upload-storage";

const register = jest.mocked(registerUploadedAsset);
const UPLOADS = "/srv/uploads";
const FORUM_DIR = path.join(UPLOADS, "forum");

const sha12 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex").slice(0, 12);
const bytesOf = (n: number, fill = 1) => new Uint8Array(n).fill(fill);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** A PNG signature padded to n bytes. */
function png(n: number, fill = 1): Uint8Array {
  const bytes = bytesOf(n, fill);
  bytes.set(PNG_SIGNATURE);
  return bytes;
}

const node: XfNode = {
  node_id: 1,
  title: "General",
  description: "",
  node_type_id: "Forum",
  parent_node_id: 0,
  display_order: 1,
};
const thread: XfThread = {
  thread_id: 10,
  node_id: 1,
  title: "Maps",
  user_id: 7,
  username: "Admin",
  post_date: 1700000000,
  last_post_date: 1700000000,
  reply_count: 1,
  view_count: 0,
  first_post_id: 1000,
  discussion_open: true,
  sticky: false,
  discussion_state: "visible",
  prefix_id: 0,
};
const post = (post_id: number, position: number, message_state = "visible"): XfPost => ({
  post_id,
  thread_id: 10,
  user_id: 7,
  username: "Admin",
  post_date: 1700000000 + position,
  message: "x",
  message_state,
  position,
  attach_count: 1,
  is_first_post: position === 0,
});

const entry = (
  attachment_id: number,
  post_id: number,
  filename: string,
  content_type: string,
  file_size: number,
  extra: Partial<AttachmentEntry> = {}
): AttachmentEntry => ({
  attachment_id,
  post_id,
  filename,
  content_type,
  file_size,
  stored: "ok",
  ...extra,
});

const BIN = (id: number) => `/snap/attachments/${id}.bin`;

const ENTRIES = [
  entry(55, 1000, "map.png", "image/png", 10),
  entry(56, 1000, "rules.pdf", "application/pdf", 8),
  entry(57, 1001, "secret.png", "image/x-png", 11),
  entry(58, 1000, "logo.svg", "image/svg+xml", 3),
  entry(59, 1000, "gone.png", "image/png", 4, { stored: "missing" }),
  entry(60, 1000, "lost.png", "image/png", 4),
  entry(61, 1000, "torn.png", "image/png", 4, { stored: "size_mismatch", received_size: 3 }),
];

function snapshot(): AttachmentSnapshot {
  return {
    nodes: [node],
    threads: [thread],
    postsByThread: new Map([[10, [post(1000, 0), post(1001, 1, "moderated")]]]),
    attachments: new Map(ENTRIES.map((e) => [e.attachment_id, e])),
    attachmentPath: BIN,
  };
}

const FILES: Record<string, Uint8Array> = {
  [BIN(55)]: png(10, 5),
  [BIN(56)]: new TextEncoder().encode("%PDF-1.4"),
  [BIN(57)]: png(11, 7),
  [BIN(58)]: bytesOf(3, 8),
  [BIN(61)]: bytesOf(3, 9),
};

function memFs(files: Record<string, Uint8Array> = FILES) {
  const store = new Map(Object.entries(files));
  const fs = {
    readFile: jest.fn(async (file: string) => {
      const bytes = store.get(file);
      if (!bytes) throw new Error(`ENOENT ${file}`);
      return bytes;
    }),
    sizeOf: jest.fn(async (file: string) => store.get(file)?.length ?? null),
    mkdir: jest.fn(async () => {}),
    writeFile: jest.fn(async (file: string, bytes: Uint8Array) => {
      store.set(file, bytes);
    }),
  } satisfies AttachmentFs;
  return { fs, store };
}

const name55 = `55-${sha12(FILES[BIN(55)]!)}-map.png`;
const name56 = `56-${sha12(FILES[BIN(56)]!)}-rules.pdf`;
const name57 = `57-${sha12(FILES[BIN(57)]!)}-secret.png`;

const savedUploadDir = process.env.UPLOAD_DIR;
beforeAll(() => {
  process.env.UPLOAD_DIR = UPLOADS;
});
afterAll(() => {
  if (savedUploadDir === undefined) delete process.env.UPLOAD_DIR;
  else process.env.UPLOAD_DIR = savedUploadDir;
});

beforeEach(() => {
  register.mockReset();
  register.mockResolvedValue({ ok: true, record: {} as never });
});

describe("planAttachmentCopies (dry run)", () => {
  it("names usable attachments by content hash and renders the rest as omitted, writing nothing", async () => {
    const { fs } = memFs();
    const plan = await planAttachmentCopies(snapshot(), null, { uploadsDir: UPLOADS, fs });
    expect(plan.attachments.map((a) => a.fileName)).toEqual([name55, name56, name57]);
    expect(plan.attachmentFor(55)).toEqual({
      kind: "image",
      url: `/images/uploads/forum/${name55}`,
      filename: "map.png",
    });
    expect(plan.attachmentFor(56)).toEqual({
      kind: "link",
      url: `/images/uploads/forum/${name56}`,
      filename: "rules.pdf",
    });
    for (const id of [58, 59, 60, 61, 999]) expect(plan.attachmentFor(id)).toBe("omitted");
    expect(plan.missing).toEqual([60]);
    expect(plan.bytes).toBe(10 + 8 + 11);
    expect(plan.skipped).toBe(0);
    expect(fs.writeFile).not.toHaveBeenCalled();
    expect(fs.mkdir).not.toHaveBeenCalled();
  });

  it("restricts attachments of hidden posts and non-public categories", async () => {
    const { fs } = memFs();
    const open = await planAttachmentCopies(snapshot(), null, { fs });
    expect(open.attachments.map((a) => [a.entry.attachment_id, a.visibility])).toEqual([
      [55, "public"],
      [56, "public"],
      [57, "restricted"],
    ]);
    const staff = await planAttachmentCopies(
      snapshot(),
      { nodes: { "1": { archive: true, visibility: "staff" } } },
      { fs }
    );
    expect(staff.attachments.every((a) => a.visibility === "restricted")).toBe(true);
  });

  it("counts a same-size file on disk as skipped and leaves its bytes out of the total", async () => {
    const { fs } = memFs({ ...FILES, [path.join(FORUM_DIR, name55)]: bytesOf(10) });
    const plan = await planAttachmentCopies(snapshot(), null, { fs });
    expect(plan.skipped).toBe(1);
    expect(plan.bytes).toBe(8 + 11);
  });

  it("restricts a post the database holds as hidden even when the snapshot says public (restricted wins)", async () => {
    const { fs } = memFs();
    const plan = await planAttachmentCopies(snapshot(), null, {
      fs,
      restrictedPosts: new Set([1000]),
    });
    expect(plan.attachments.map((a) => [a.entry.attachment_id, a.visibility])).toEqual([
      [55, "restricted"],
      [56, "restricted"],
      [57, "restricted"],
    ]);
    await copyAttachments(plan, { fs });
    expect(register.mock.calls.map(([input]) => [input.sourceRef, input.visibility])).toEqual([
      ["55", "restricted"],
      ["57", "restricted"],
    ]);
  });

  it("omits files that do not start with their type's signature and counts them", async () => {
    const { fs } = memFs({ ...FILES, [BIN(55)]: bytesOf(10, 0x3c) });
    const plan = await planAttachmentCopies(snapshot(), null, { fs });
    expect(plan.signatureMismatch).toEqual([55]);
    expect(plan.attachmentFor(55)).toBe("omitted");
    expect(plan.attachments.map((a) => a.entry.attachment_id)).toEqual([56, 57]);
  });

  it("skips and counts snapshot entries whose id is not a positive integer", async () => {
    const snap = snapshot();
    const bad = [-5, 0, 1.5, Number.NaN, 1e21];
    for (const id of bad) snap.attachments.set(id, { ...ENTRIES[0]!, attachment_id: id });
    const { fs } = memFs();
    const plan = await planAttachmentCopies(snap, null, { fs });
    expect(plan.invalidIds).toBe(bad.length);
    expect(plan.attachments.map((a) => a.entry.attachment_id)).toEqual([55, 56, 57]);
  });

  it("refuses a directory other than uploadsDir() before reading anything", async () => {
    const { fs } = memFs();
    await expect(
      planAttachmentCopies(snapshot(), null, { uploadsDir: "/elsewhere", fs })
    ).rejects.toThrow(/uploadsDir\(\)/);
    expect(fs.readFile).not.toHaveBeenCalled();
    expect(fs.sizeOf).not.toHaveBeenCalled();
  });

  it("refuses to copy a plan made for another directory", async () => {
    const { fs } = memFs();
    const plan = await planAttachmentCopies(snapshot(), null, { fs });
    await expect(copyAttachments({ ...plan, dir: "/elsewhere/forum" }, { fs })).rejects.toThrow(
      /uploadsDir\(\)/
    );
    expect(fs.mkdir).not.toHaveBeenCalled();
    expect(fs.writeFile).not.toHaveBeenCalled();
  });

  it("serves the forum prefix under the uploads prefix", () => {
    expect(ATTACHMENT_URL_PREFIX).toBe(`${UPLOADS_URL_PREFIX}forum/`);
  });
});

describe("copyAttachments", () => {
  it("copies absent files into <uploadsDir>/forum and reports totals", async () => {
    const { fs, store } = memFs();
    const plan = await planAttachmentCopies(snapshot(), null, { fs });
    const result = await copyAttachments(plan, { fs });
    expect(fs.mkdir).toHaveBeenCalledWith(FORUM_DIR);
    expect(store.get(path.join(FORUM_DIR, name55))).toEqual(FILES[BIN(55)]);
    expect(store.get(path.join(FORUM_DIR, name56))).toEqual(FILES[BIN(56)]);
    expect(result).toEqual({
      copied: 3,
      skipped: 0,
      bytes: 29,
      missing: [60],
      registered: 2,
      assetsPending: [],
      assetsFailed: [],
    });
  });

  it("skips a same-size target, overwrites a different-size one and ignores thumbnails", async () => {
    const { fs, store } = memFs({
      ...FILES,
      [path.join(FORUM_DIR, name55)]: bytesOf(10),
      [path.join(FORUM_DIR, name56)]: bytesOf(2),
      [`${path.join(FORUM_DIR, name57)}.thumb.webp`]: bytesOf(11),
    });
    const plan = await planAttachmentCopies(snapshot(), null, { fs });
    const result = await copyAttachments(plan, { fs });
    expect(result).toMatchObject({ copied: 2, skipped: 1, bytes: 19 });
    expect(store.get(path.join(FORUM_DIR, name55))).toEqual(bytesOf(10));
    expect(store.get(path.join(FORUM_DIR, name56))).toEqual(FILES[BIN(56)]);
    expect(store.get(path.join(FORUM_DIR, name57))).toEqual(FILES[BIN(57)]);
    expect(fs.writeFile).toHaveBeenCalledTimes(2);
  });

  it("reports a snapshot file that vanished after the dry run as missing", async () => {
    const { fs, store } = memFs();
    const plan = await planAttachmentCopies(snapshot(), null, { fs });
    store.delete(BIN(56));
    const result = await copyAttachments(plan, { fs });
    expect(result.missing).toEqual([60, 56]);
    expect(result.copied).toBe(2);
  });

  it("registers images (not PDFs) as forum assets with their visibility", async () => {
    const { fs } = memFs();
    const plan = await planAttachmentCopies(snapshot(), null, { fs });
    await copyAttachments(plan, { fs });
    expect(register.mock.calls.map(([input]) => input)).toEqual([
      {
        filePath: path.join(FORUM_DIR, name55),
        url: `/images/uploads/forum/${name55}`,
        mimeType: "image/png",
        source: "forum",
        uploaderClerkId: null,
        sourceRef: "55",
        title: "map.png",
        visibility: "public",
      },
      {
        filePath: path.join(FORUM_DIR, name57),
        url: `/images/uploads/forum/${name57}`,
        mimeType: "image/png",
        source: "forum",
        uploaderClerkId: null,
        sourceRef: "57",
        title: "secret.png",
        visibility: "restricted",
      },
    ]);
  });

  it("counts retryable registration failures as pending and the rest as failed, never failing", async () => {
    register
      .mockResolvedValueOnce({ ok: false, reason: "table-missing", retryable: true })
      .mockResolvedValueOnce({ ok: false, reason: "invalid-input", retryable: false });
    const { fs } = memFs();
    const log = jest.fn();
    const plan = await planAttachmentCopies(snapshot(), null, { fs });
    const result = await copyAttachments(plan, { fs, log });
    expect(result).toMatchObject({
      copied: 3,
      registered: 0,
      assetsPending: [55],
      assetsFailed: [{ attachmentId: 57, reason: "invalid-input" }],
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining("57"));
  });
});
