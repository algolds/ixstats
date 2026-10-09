/** @jest-environment node */
import { createHash } from "crypto";
import {
  ATTACHMENT_URL_PREFIX,
  attachmentFileName,
  attachmentPolicy,
  attachmentUrl,
  hasSignature,
  isStoredComplete,
  isValidAttachmentId,
  normalizedMime,
  postVisibilities,
  type KeptAttachment,
} from "~/lib/thinkpages-forum/import/attachments";
import type { NodeMapFile } from "~/lib/thinkpages-forum/import/node-map";
import type { AttachmentEntry } from "~/lib/thinkpages-forum/import/snapshot";
import type { XfNode, XfPost, XfThread } from "~/lib/thinkpages-forum/import/xenforo-types";

const MB = 1024 * 1024;

const entry = (extra: Partial<AttachmentEntry> = {}): AttachmentEntry => ({
  attachment_id: 55,
  post_id: 1000,
  filename: "x.png",
  content_type: "image/png",
  file_size: 4,
  stored: "ok",
  ...extra,
});

const sha12 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex").slice(0, 12);

describe("attachmentPolicy", () => {
  it.each(["image/png", "image/jpeg", "image/gif", "image/webp", "Image/PNG; charset=binary"])(
    "inlines %s as an image",
    (content_type) => {
      expect(attachmentPolicy({ content_type, file_size: 10 })).toMatchObject({ kind: "image" });
    }
  );

  it("allows an image of exactly 20 MB and omits one a byte over", () => {
    expect(attachmentPolicy({ content_type: "image/png", file_size: 20 * MB })).toMatchObject({
      kind: "image",
      maxBytes: 20 * MB,
      extension: "png",
    });
    expect(attachmentPolicy({ content_type: "image/png", file_size: 20 * MB + 1 })).toEqual({
      kind: "omit",
      reason: "oversize",
    });
  });

  it("links a PDF up to exactly 25 MB and omits one a byte over", () => {
    expect(attachmentPolicy({ content_type: "application/pdf", file_size: 25 * MB })).toMatchObject(
      {
        kind: "link",
        maxBytes: 25 * MB,
        extension: "pdf",
      }
    );
    expect(attachmentPolicy({ content_type: "application/pdf", file_size: 25 * MB + 1 })).toEqual({
      kind: "omit",
      reason: "oversize",
    });
  });

  it.each(["image/svg+xml", "text/plain", "application/zip", "text/html", "post", ""])(
    "omits %s by type",
    (content_type) => {
      expect(attachmentPolicy({ content_type, file_size: 10 })).toEqual({
        kind: "omit",
        reason: "type",
      });
    }
  );
});

describe("MIME aliases, signatures and ids", () => {
  it.each([
    ["image/jpg", "image/jpeg", "jpg"],
    ["image/pjpeg", "image/jpeg", "jpg"],
    ["IMAGE/X-PNG", "image/png", "png"],
  ])("treats %s as %s", (alias, mime, extension) => {
    expect(normalizedMime(alias)).toBe(mime);
    expect(attachmentPolicy({ content_type: alias, file_size: 10 })).toMatchObject({
      kind: "image",
      extension,
    });
  });

  const kept = (content_type: string) =>
    attachmentPolicy({ content_type, file_size: 10 }) as KeptAttachment;
  const bytes = (...parts: Array<string | number[]>) =>
    Uint8Array.from(
      parts.flatMap((p) => (typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p))
    );

  it.each([
    ["image/png", bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a, 0])],
    ["image/jpeg", bytes([0xff, 0xd8, 0xff, 0xe0])],
    ["image/gif", bytes("GIF89a")],
    ["image/webp", bytes("RIFF", [1, 2, 3, 4], "WEBPVP8 ")],
    ["application/pdf", bytes("%PDF-1.7")],
  ])("accepts a real %s signature", (mime, data) => {
    expect(hasSignature(kept(mime), data)).toBe(true);
  });

  it.each([
    ["image/png", bytes("<html><script>")],
    ["image/jpeg", bytes([0xff, 0xd8])],
    ["image/gif", bytes("GIF")],
    ["image/webp", bytes("RIFF", [1, 2, 3, 4], "WAVE")],
    ["application/pdf", bytes("%PD")],
    ["image/png", new Uint8Array()],
  ])("refuses %s bytes without its signature", (mime, data) => {
    expect(hasSignature(kept(mime), data)).toBe(false);
  });

  it("accepts only positive safe integer ids", () => {
    expect([1, 55, Number.MAX_SAFE_INTEGER].every(isValidAttachmentId)).toBe(true);
    expect([0, -5, 1.5, Number.NaN, 1e21, Infinity].some(isValidAttachmentId)).toBe(false);
  });
});

describe("isStoredComplete", () => {
  it("counts only stored ok entries whose bytes are the recorded size", () => {
    expect(isStoredComplete(entry())).toBe(true);
    expect(isStoredComplete(entry({ received_size: 4 }))).toBe(true);
    expect(isStoredComplete(entry({ received_size: 3 }))).toBe(false);
    for (const stored of ["missing", "forbidden", "oversize", "skipped", "size_mismatch"] as const)
      expect(isStoredComplete(entry({ stored }))).toBe(false);
  });
});

describe("attachmentFileName", () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);

  it("is <id>-<sha256 12 hex>-<safe basename> and drops directories", () => {
    expect(attachmentFileName({ attachment_id: 55, filename: "../x.png" }, bytes, "png")).toBe(
      `55-${sha12(bytes)}-x.png`
    );
    expect(attachmentFileName({ attachment_id: 55, filename: "..\\..\\x.png" }, bytes, "png")).toBe(
      `55-${sha12(bytes)}-x.png`
    );
  });

  it("is stable for the same bytes and changes with them", () => {
    const a = attachmentFileName({ attachment_id: 7, filename: "map.png" }, bytes, "png");
    expect(attachmentFileName({ attachment_id: 7, filename: "map.png" }, bytes, "png")).toBe(a);
    expect(
      attachmentFileName({ attachment_id: 7, filename: "map.png" }, new Uint8Array([9]), "png")
    ).not.toBe(a);
  });

  it("keeps only [A-Za-z0-9_-] in the stem and takes the extension from the type", () => {
    const name = attachmentFileName(
      { attachment_id: 9, filename: "my photo <b>.final.HTML" },
      bytes,
      "png"
    );
    expect(name).toBe(`9-${sha12(bytes)}-my-photo-b-final.png`);
    expect(name.slice(name.indexOf("-", 2) + 1)).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it("never ends a stored name in .thumb.webp and never starts the basename with a dot", () => {
    const thumb = attachmentFileName({ attachment_id: 3, filename: "a.thumb.webp" }, bytes, "webp");
    expect(thumb).toBe(`3-${sha12(bytes)}-a-thumb.webp`);
    expect(attachmentFileName({ attachment_id: 3, filename: ".htaccess" }, bytes, "pdf")).toBe(
      `3-${sha12(bytes)}-htaccess.pdf`
    );
  });

  it("caps the basename at 60 characters and names an empty one file", () => {
    const long = attachmentFileName(
      { attachment_id: 1, filename: `${"a".repeat(200)}.png` },
      bytes,
      "png"
    );
    const basename = long.slice(`1-${sha12(bytes)}-`.length);
    expect(basename.length).toBeLessThanOrEqual(60);
    expect(basename.endsWith(".png")).toBe(true);
    expect(attachmentFileName({ attachment_id: 1, filename: "???.png" }, bytes, "png")).toBe(
      `1-${sha12(bytes)}-file.png`
    );
  });

  it("serves under the forum uploads prefix", () => {
    expect(ATTACHMENT_URL_PREFIX).toBe("/images/uploads/forum/");
    expect(attachmentUrl("55-abc-x.png")).toBe("/images/uploads/forum/55-abc-x.png");
  });
});

describe("postVisibilities", () => {
  const node = (node_id: number, title: string, node_type_id = "Forum"): XfNode => ({
    node_id,
    title,
    description: "",
    node_type_id,
    parent_node_id: 0,
    display_order: node_id,
  });
  const thread = (thread_id: number, node_id: number, extra: Partial<XfThread> = {}): XfThread => ({
    thread_id,
    node_id,
    title: `Thread ${thread_id}`,
    user_id: 7,
    username: "Admin",
    post_date: 1700000000,
    last_post_date: 1700000000,
    reply_count: 0,
    view_count: 0,
    first_post_id: thread_id * 10,
    discussion_open: true,
    sticky: false,
    discussion_state: "visible",
    prefix_id: 0,
    ...extra,
  });
  const post = (
    post_id: number,
    thread_id: number,
    position: number,
    state = "visible"
  ): XfPost => ({
    post_id,
    thread_id,
    user_id: 7,
    username: "Admin",
    post_date: 1700000000 + position,
    message: "x",
    message_state: state,
    position,
    attach_count: 1,
    is_first_post: position === 0,
  });

  function snap(nodes: XfNode[], threads: XfThread[], posts: XfPost[]) {
    const postsByThread = new Map<number, XfPost[]>();
    for (const p of posts)
      postsByThread.set(p.thread_id, [...(postsByThread.get(p.thread_id) ?? []), p]);
    return { nodes, threads, postsByThread };
  }

  const nodes = [node(1, "General Discussion"), node(2, "Old Stuff"), node(3, "Group", "Category")];

  it("is public for visible posts in public categories and restricted for moderated ones", () => {
    const map = postVisibilities(
      snap(nodes, [thread(10, 1)], [post(100, 10, 0), post(101, 10, 1, "moderated")]),
      null
    );
    expect(map.get(100)).toBe("public");
    expect(map.get(101)).toBe("restricted");
  });

  it("restricts every post of a moderated thread or a thread whose first post is moderated", () => {
    const map = postVisibilities(
      snap(
        nodes,
        [thread(10, 1, { discussion_state: "moderated" }), thread(20, 1)],
        [post(100, 10, 0), post(101, 10, 1), post(200, 20, 0, "moderated"), post(201, 20, 1)]
      ),
      null
    );
    expect([100, 101, 200, 201].map((id) => map.get(id))).toEqual([
      "restricted",
      "restricted",
      "restricted",
      "restricted",
    ]);
  });

  it("restricts posts landing in a non-public category (staff archive, staff seed)", () => {
    const nodeMap: NodeMapFile = {
      nodes: { "1": { scope: "site", key: "staff" }, "2": { archive: true, visibility: "staff" } },
    };
    const map = postVisibilities(
      snap(nodes, [thread(10, 1), thread(20, 2)], [post(100, 10, 0), post(200, 20, 0)]),
      nodeMap
    );
    expect(map.get(100)).toBe("restricted");
    expect(map.get(200)).toBe("restricted");
  });

  it("is public in a published realm's category and restricted in an unpublished realm's (I6)", () => {
    const nodeMap: NodeMapFile = {
      nodes: {
        "1": { scope: "realm", realm: "urcea", key: "hub" },
        "2": { scope: "realm", realm: "drafty", key: "hub" },
      },
    };
    const snapshot = snap(
      nodes,
      [thread(10, 1), thread(20, 2)],
      [post(100, 10, 0), post(200, 20, 0)]
    );
    const map = postVisibilities(snapshot, nodeMap, [], new Set(["urcea"]));
    expect([map.get(100), map.get(200)]).toEqual(["public", "restricted"]);
    const unknown = postVisibilities(snapshot, nodeMap);
    expect([unknown.get(100), unknown.get(200)]).toEqual(["restricted", "restricted"]);
  });

  it("takes a mapped sitewide key's visibility from the database, and treats an unknown key as not public", () => {
    const nodeMap: NodeMapFile = {
      nodes: { "1": { scope: "site", key: "general" }, "2": { scope: "site", key: "xf-99" } },
    };
    const snapshot = snap(
      nodes,
      [thread(10, 1), thread(20, 2)],
      [post(100, 10, 0), post(200, 20, 0)]
    );
    const seedsOnly = postVisibilities(snapshot, nodeMap);
    expect([seedsOnly.get(100), seedsOnly.get(200)]).toEqual(["public", "restricted"]);
    const fromDb = postVisibilities(snapshot, nodeMap, [
      { key: "general", visibility: "staff" },
      { key: "xf-99", visibility: "public" },
    ]);
    expect([fromDb.get(100), fromDb.get(200)]).toEqual(["restricted", "public"]);
  });

  it("leaves out posts that are not imported: deleted posts, deleted threads, skipped nodes", () => {
    const map = postVisibilities(
      snap(
        [...nodes, node(4, "Skipped")],
        [
          thread(10, 1),
          thread(20, 1, { discussion_state: "deleted" }),
          thread(30, 1),
          thread(40, 4),
        ],
        [
          post(100, 10, 0),
          post(101, 10, 1, "deleted"),
          post(200, 20, 0),
          post(300, 30, 0, "deleted"),
          post(301, 30, 1),
          post(400, 40, 0),
        ]
      ),
      { nodes: { "4": { skip: true } } }
    );
    expect([...map.keys()]).toEqual([100]);
  });
});
