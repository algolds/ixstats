/** @jest-environment node */
import type { AttachmentEntry } from "~/lib/thinkpages-forum/import/snapshot";
import type { ResolvedNode } from "~/lib/thinkpages-forum/import/node-map";
import type { XfNode } from "~/lib/thinkpages-forum/import/xenforo-types";
import type {
  AttachmentCopyPlan,
  PlannedAttachment,
} from "~/server/modules/thinkpages-forum/import-attachments";
import {
  importDatabaseUrl,
  parseImportArgs,
  runBanner,
} from "../../../scripts/migrations/import-xenforo-forum-args";
import {
  applyRefusals,
  attachmentPlanLines,
  attachmentResultLines,
  diskRefusal,
  failedThreadLines,
  omittedByReason,
  redirectOnRefusal,
  rollbackPreviewLines,
  snapshotGapLines,
  targetLines,
  unmappedForumNodes,
  unmappedLines,
} from "../../../scripts/migrations/import-xenforo-forum-plan";
import { databaseLabel } from "../../../scripts/lib/database-guard";

const url = (db: string) => `postgresql://u:p@localhost:5433/${db}?schema=public`;
const CLONE = url("ixstats_wv1");
const PROD = url("ixstats");

describe("parseImportArgs", () => {
  it("parses a dry run, an apply and their options", () => {
    expect(parseImportArgs(["--snapshot", "dir"], CLONE)).toEqual({
      args: {
        snapshot: "dir",
        nodeMap: null,
        report: null,
        apply: false,
        acceptUnmapped: false,
        production: false,
        rollback: false,
        yes: false,
      },
    });
    const parsed = parseImportArgs(
      [
        "--snapshot",
        "dir",
        "--node-map",
        "map.json",
        "--report",
        "r.json",
        "--apply",
        "--accept-defaults",
      ],
      CLONE
    );
    expect(parsed).toMatchObject({
      args: { nodeMap: "map.json", report: "r.json", apply: true, acceptUnmapped: true },
    });
    expect(parseImportArgs(["--snapshot", "dir", "--accept-unmapped"], CLONE)).toMatchObject({
      args: { acceptUnmapped: true },
    });
  });

  it("requires --snapshot, a value for each value flag, and known flags only", () => {
    expect(parseImportArgs(["--apply"], CLONE)).toEqual({
      error: expect.stringMatching(/--snapshot/),
    });
    expect(parseImportArgs(["--snapshot"], CLONE)).toEqual({ error: "--snapshot needs a value" });
    expect(parseImportArgs(["--snapshot", "--apply"], CLONE)).toEqual({
      error: "--snapshot needs a value",
    });
    expect(parseImportArgs(["--snapshot", "dir", "--aply"], CLONE)).toEqual({
      error: "Unknown argument: --aply",
    });
  });

  it("refuses the production database without --production, apply or not", () => {
    expect(parseImportArgs(["--snapshot", "dir", "--apply"], PROD)).toEqual({
      error: expect.stringMatching(/production database "ixstats"/),
    });
    expect(parseImportArgs(["--snapshot", "dir"], PROD)).toHaveProperty("error");
    expect(parseImportArgs(["--snapshot", "dir", "--apply", "--production"], PROD)).toMatchObject({
      args: { apply: true, production: true },
    });
    expect(parseImportArgs(["--snapshot", "dir"], undefined)).toHaveProperty("error");
  });

  it("takes a rollback without --yes as a preview, never combines it with --apply (I2)", () => {
    expect(parseImportArgs(["--snapshot", "dir", "--rollback"], CLONE)).toMatchObject({
      args: { rollback: true, yes: false },
    });
    expect(parseImportArgs(["--snapshot", "dir", "--yes"], CLONE)).toEqual({
      error: "--yes only goes with --rollback",
    });
    expect(parseImportArgs(["--snapshot", "dir", "--rollback", "--yes", "--apply"], CLONE)).toEqual(
      {
        error: "--rollback and --apply cannot be combined",
      }
    );
    expect(parseImportArgs(["--snapshot", "dir", "--rollback", "--yes"], CLONE)).toMatchObject({
      args: { rollback: true, yes: true, apply: false },
    });
    expect(parseImportArgs(["--snapshot", "dir", "--rollback"], PROD)).toHaveProperty("error");
    expect(parseImportArgs(["--snapshot", "dir", "--rollback", "--yes"], PROD)).toHaveProperty(
      "error"
    );
  });
});

describe("runBanner", () => {
  it("says what the run was asked to do, a refused rollback included", () => {
    expect(runBanner(["--snapshot", "d"])).toBe("DRY RUN — pass --apply to write");
    expect(runBanner(["--snapshot", "d", "--apply"])).toBe("APPLY mode — writing");
    expect(runBanner(["--snapshot", "d", "--rollback"])).toBe(
      "ROLLBACK PREVIEW — nothing is deleted; pass --yes to delete"
    );
    expect(runBanner(["--snapshot", "d", "--rollback", "--yes"])).toBe(
      "ROLLBACK — deleting the import"
    );
  });
});

describe("importDatabaseUrl", () => {
  it("pins one never-reaped connection and keeps the other parameters and credentials", () => {
    const out = new URL(
      importDatabaseUrl(
        "postgresql://user:p%40ss@db:5433/ixstats_wv1?schema=public&sslmode=require"
      )
    );
    expect(out.username).toBe("user");
    expect(out.password).toBe("p%40ss");
    expect(`${out.host}${out.pathname}`).toBe("db:5433/ixstats_wv1");
    expect(Object.fromEntries(out.searchParams)).toEqual({
      schema: "public",
      sslmode: "require",
      connection_limit: "1",
      max_idle_connection_lifetime: "0",
    });
  });

  it("overrides a pool size already in the URL", () => {
    const out = new URL(
      importDatabaseUrl(`${CLONE}&connection_limit=20&max_idle_connection_lifetime=300`)
    );
    expect(out.searchParams.get("connection_limit")).toBe("1");
    expect(out.searchParams.get("max_idle_connection_lifetime")).toBe("0");
    expect(out.searchParams.getAll("connection_limit")).toHaveLength(1);
  });
});

const node = (node_id: number, title: string, node_type_id = "Forum"): XfNode => ({
  node_id,
  title,
  description: "",
  node_type_id,
  parent_node_id: 0,
  display_order: 1,
});

describe("apply refusals", () => {
  const resolved: ResolvedNode[] = [
    { node: node(1, "Community", "Category"), target: { skip: true }, source: "default" },
    { node: node(12, "Lore"), target: { archive: true }, source: "default" },
    { node: node(13, "General"), target: { scope: "site", key: "general" }, source: "heuristic" },
    { node: node(14, "Staff"), target: { archive: true, visibility: "staff" }, source: "map" },
  ];

  it("lists every Forum node placed by a heuristic or the default, with its proposed target (I1)", () => {
    const unmapped = unmappedForumNodes(resolved);
    expect(unmapped.map((r) => r.node.node_id)).toEqual([12, 13]);
    expect(unmappedLines(unmapped)).toEqual([
      "Forum nodes without a node map entry (2), with their proposed targets:",
      '  12 "Lore" -> archive:xf-12 (public) [default]',
      '  13 "General" -> site:general [heuristic]',
    ]);
    expect(unmappedLines([])).toEqual(["Every Forum node has a node map entry."]);
  });

  it("refuses on blocking lines and on unmapped nodes unless accepted; blocking is never accepted", () => {
    const unmapped = unmappedForumNodes(resolved);
    expect(
      applyRefusals({ blocking: ["visibility differs"], unmapped, acceptUnmapped: false })
    ).toEqual([
      "visibility differs",
      'Node 12 "Lore" has no node map entry (proposed: archive:xf-12 (public), default): map it, or pass --accept-unmapped.',
      'Node 13 "General" has no node map entry (proposed: site:general, heuristic): map it, or pass --accept-unmapped.',
    ]);
    expect(applyRefusals({ blocking: [], unmapped, acceptUnmapped: true })).toEqual([]);
    expect(applyRefusals({ blocking: ["b"], unmapped, acceptUnmapped: true })).toEqual(["b"]);
  });
});

describe("rollback lines (I2)", () => {
  it("prints exactly what --yes would delete", () => {
    expect(
      rollbackPreviewLines({
        threads: 3,
        posts: 7,
        nativeReplies: 1,
        links: 2,
        categories: ["xf-12", "xf-13"],
        nodeMap: 1,
        assets: 4,
        files: 5,
      })
    ).toEqual([
      "Rollback preview (nothing deleted): 3 imported threads, 7 posts (1 native replies on imported threads)",
      "  action links on those posts: 2 (returned to their XenForo post, or deleted with a native reply)",
      "  archive categories 2 (xf-12, xf-13), node map rows 1, forum media assets 4, copied files 5",
      "Pass --yes to delete these (the legacy redirect must be off).",
    ]);
  });

  it("tells the operator to turn the redirect off first", () => {
    expect(redirectOnRefusal(false)).toBe(
      "The legacy redirect is on. Turn the legacy redirect off first: bun run forum:legacy-redirect -- off"
    );
    expect(redirectOnRefusal(true)).toMatch(/forum:legacy-redirect -- --production off$/);
  });
});

describe("failedThreadLines (M19)", () => {
  it("lists the XenForo ids of the threads that failed, with their errors", () => {
    expect(failedThreadLines([])).toEqual([]);
    expect(
      failedThreadLines([
        { xenforoThreadId: 101, error: "timeout" },
        { xenforoThreadId: 205, error: "unique" },
      ])
    ).toEqual([
      "FAILED: 2 threads were rolled back and not imported; XenForo thread ids: 101, 205",
      "  thread 101: timeout",
      "  thread 205: unique",
    ]);
  });
});

describe("targetLines", () => {
  it("prints the upload directory and the database without its credentials", () => {
    const lines = targetLines("/srv/uploads", databaseLabel(PROD));
    expect(lines).toEqual(["Upload directory: /srv/uploads", "Database: localhost:5433/ixstats"]);
    expect(lines.join("\n")).not.toMatch(/u:p|schema/);
  });
});

describe("diskRefusal", () => {
  const dir = "/srv/uploads";

  it("needs a writable directory with twice the planned bytes free", () => {
    expect(diskRefusal({ dir, writable: false, freeBytes: 1e9, plannedBytes: 0 })).toMatch(
      /not writable/
    );
    expect(diskRefusal({ dir, writable: true, freeBytes: 199, plannedBytes: 100 })).toMatch(
      /needs 200/
    );
    expect(diskRefusal({ dir, writable: true, freeBytes: null, plannedBytes: 100 })).toMatch(
      /unknown/
    );
    expect(diskRefusal({ dir, writable: true, freeBytes: 200, plannedBytes: 100 })).toBeNull();
    expect(diskRefusal({ dir, writable: true, freeBytes: null, plannedBytes: 0 })).toBeNull();
  });
});

describe("snapshotGapLines", () => {
  it("names what the export still has to fetch", () => {
    expect(
      snapshotGapLines({
        complete: false,
        nodesPending: true,
        forumsWithoutThreads: [12],
        threadsWithoutPosts: [100, 101],
        usersMissing: [7],
        attachmentsMissing: [55],
        threadsRedirect: [],
        threadsGone: [],
        threadsEmpty: [],
        attachmentsUnavailable: [],
        attachmentsSizeMismatch: [],
      })
    ).toEqual([
      "the node list",
      "forums without threads: 12",
      "threads without posts: 100, 101",
      "attachments: 55",
    ]);
  });
});

describe("attachment lines", () => {
  const entry = (attachment_id: number, extra: Partial<AttachmentEntry> = {}): AttachmentEntry => ({
    attachment_id,
    post_id: 1000,
    filename: "a.png",
    content_type: "image/png",
    file_size: 10,
    stored: "ok",
    ...extra,
  });
  const entries = [
    entry(1),
    entry(2, { content_type: "image/svg+xml" }),
    entry(3, { file_size: 30 * 1024 * 1024 }),
    entry(4, { stored: "forbidden" }),
    entry(5),
    entry(6),
    entry(7),
    entry(-1),
  ];
  const kept = (
    id: number,
    visibility: "public" | "restricted",
    copy: boolean
  ): PlannedAttachment => ({
    entry: entry(id),
    kind: "image",
    mimeType: "image/png",
    fileName: `${id}.png`,
    url: `/images/uploads/forum/${id}.png`,
    source: `${id}.bin`,
    target: `/srv/uploads/forum/${id}.png`,
    visibility,
    copy,
  });
  const plan: AttachmentCopyPlan = {
    dir: "/srv/uploads/forum",
    attachments: [kept(1, "public", true), kept(7, "restricted", false)],
    attachmentFor: () => "omitted",
    bytes: 10,
    skipped: 1,
    missing: [5],
    signatureMismatch: [6],
    invalidIds: 1,
  };

  it("counts omissions by reason", () => {
    expect(Object.fromEntries(omittedByReason(entries, plan))).toEqual({
      "type not kept": 1,
      "over the size limit": 1,
      "snapshot forbidden": 1,
      "snapshot file missing or short": 1,
      "bytes do not match the type": 1,
      "invalid id": 1,
    });
    expect(Object.fromEntries(omittedByReason([entry(8)], plan))).toEqual({
      "post not imported": 1,
    });
  });

  it("prints the copy plan with signature mismatches, invalid ids and disk bytes", () => {
    expect(attachmentPlanLines(entries, plan)).toEqual([
      "Attachment copy: 2 kept (2 images, 0 links; 1 restricted), 1 to copy (10 bytes on disk), 1 already on disk",
      "  missing or short snapshot files 1, signature mismatches 1, invalid ids 1",
      "  omitted by reason: type not kept 1, over the size limit 1, snapshot forbidden 1, snapshot file missing or short 1, bytes do not match the type 1, invalid id 1",
    ]);
  });

  it("prints the copy result with assets registered, pending and failed by reason", () => {
    expect(
      attachmentResultLines({
        copied: 2,
        skipped: 1,
        bytes: 20,
        missing: [5],
        registered: 1,
        assetsPending: [9],
        assetsFailed: [
          { attachmentId: 3, reason: "invalid-input" },
          { attachmentId: 4, reason: "invalid-input" },
        ],
      })
    ).toEqual([
      "Attachments: 2 copied (20 bytes), 1 already on disk, 1 missing",
      "  media assets: 1 registered, 1 pending (a rerun retries), failed: invalid-input 2",
    ]);
  });
});
