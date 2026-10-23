/** @jest-environment node */
/**
 * The IxWiki link conversion's apply (design decision 8): the deploy runs it with --apply on every release, so a second
 * run writes nothing, every claim is written under its name's lock (41103), and one marker row tells the removal SQL the
 * conversion ran.
 */
import { CONVERSION_MARKER, type ConversionPlan } from "~/lib/identity/legacy-identity";
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  applyConversion,
  parseConvertArgs,
} from "../../../scripts/identity/convert-wiki-name-claims";

const at = new Date("2026-10-01T00:00:00Z");
let db: MemoryPrisma;

const plan: ConversionPlan = {
  create: [
    {
      userId: "a",
      name: "Alpha",
      status: "APPROVED",
      visible: false,
      rightsPass: true,
      decidedById: null,
      decidedAt: at,
      mwUserId: 7,
      decisionNote: "Converted from a wiki link its account proved with a token",
    },
    {
      userId: "b",
      name: "Beta",
      status: "PENDING",
      visible: true,
      rightsPass: false,
      decidedById: null,
      decidedAt: null,
      mwUserId: null,
      decisionNote: "Converted from the old wiki name field",
    },
  ],
  skipped: [{ userId: "c", name: "Gamma", reason: "EXISTS" }],
  conflicts: [],
};

beforeEach(async () => {
  db = createMemoryPrisma();
  for (const id of ["a", "b", "c"])
    await db.user.create({ data: { id, clerkUserId: `user_${id}` } });
});

describe("applyConversion", () => {
  it("creates the claims once and one marker row, however often it runs", async () => {
    expect(await applyConversion(db, plan)).toEqual({ created: 2 });
    expect(await applyConversion(db, plan)).toEqual({ created: 0 });

    const claims = await db.wikiNameClaim.findMany({ orderBy: { name: "asc" } });
    expect(claims).toEqual([
      expect.objectContaining({
        userId: "a",
        source: "ixwiki",
        name: "Alpha",
        status: "APPROVED",
        visible: false,
        rightsPass: true,
        origin: "CONVERSION",
        requestedById: "a",
        decidedById: null,
        decidedAt: at,
        mwUserId: 7,
        decisionNote: "Converted from a wiki link its account proved with a token",
      }),
      expect.objectContaining({
        userId: "b",
        name: "Beta",
        status: "PENDING",
        origin: "CONVERSION",
        requestedById: "b",
      }),
    ]);
    const markers = await db.adminAuditLog.findMany({ where: { action: CONVERSION_MARKER } });
    expect(markers).toEqual([
      expect.objectContaining({
        targetType: "system",
        targetId: "wiki_name_claims",
        targetName: "IxWiki links",
        adminId: "system",
        adminName: "convert-wiki-name-claims",
      }),
    ]);
    expect(JSON.parse(markers[0]!.changes)).toMatchObject({
      created: 2,
      approved: 1,
      pending: 1,
      skipped: { EXISTS: 1, NAME_TAKEN: 0, INVALID: 0 },
      conflicts: 0,
    });
  });

  it("takes each name's lock before it writes, and leaves a name another account took meanwhile", async () => {
    await db.wikiNameClaim.create({
      data: {
        userId: "c",
        name: "Alpha",
        status: "APPROVED",
        origin: "ADMIN_LINK",
        requestedById: "c",
      },
    });
    db.store.log = [];
    expect(await applyConversion(db, plan)).toEqual({ created: 1 });

    const locks = db.store.log.filter((e) => e.kind === "advisory");
    expect(locks).toEqual([
      { kind: "advisory", ns: 41103, key: "ixwiki:Alpha" },
      { kind: "advisory", ns: 41103, key: "ixwiki:Beta" },
    ]);
    const firstWrite = db.store.log.findIndex((e) => e.kind === "write");
    expect(firstWrite).toBeGreaterThan(db.store.log.lastIndexOf(locks[1]!));
    expect(await db.wikiNameClaim.count({ where: { name: "Alpha" } })).toBe(1);
  });

  it("writes only the marker when there is nothing to convert", async () => {
    expect(await applyConversion(db, { create: [], skipped: [], conflicts: [] })).toEqual({
      created: 0,
    });
    expect(await db.adminAuditLog.count({ where: { action: CONVERSION_MARKER } })).toBe(1);
    expect(await db.wikiNameClaim.count()).toBe(0);
  });
});

describe("parseConvertArgs", () => {
  it("is a dry run unless --apply is given", () => {
    expect(parseConvertArgs(["--apply"])).toEqual({ apply: true });
    expect(parseConvertArgs([])).toEqual({ apply: false });
  });
});
