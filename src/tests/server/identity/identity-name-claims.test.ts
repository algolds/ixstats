/** @jest-environment node */
/** Name claims (design decisions 3, 5, 6, 7): request, decide, revoke, admin link; one owner per name; the system-owner rule. */
import { createMemoryPrisma, type MemoryPrisma } from "~/tests/helpers/memory-prisma";
import {
  createNameClaimService,
  MAX_PENDING_CLAIMS,
  NameClaimError,
  type NameClaimErrorCode,
  toNameClaimTrpcError,
} from "~/server/modules/identity/identity.name-claims";
import type { ClaimApprovedEvent, ClaimRevokedEvent } from "~/lib/identity/claim-hooks";

let db: MemoryPrisma;
let events: ClaimApprovedEvent[];
let revocations: ClaimRevokedEvent[];
const service = () =>
  createNameClaimService(db, {
    hooks: [
      async (e) => {
        events.push(e);
      },
    ],
    revokedHooks: [
      async (e) => {
        revocations.push(e);
      },
    ],
  });
const actor = (userId: string, isSystemOwner = false) => ({
  userId,
  clerkUserId: `user_${userId}`,
  isSystemOwner,
});
const admin = actor("admin");
const owner = actor("owner", true);
const refusal = (promise: Promise<object>) =>
  promise.then(
    () => null,
    (e: NameClaimError) => e.code
  );

beforeEach(async () => {
  db = createMemoryPrisma();
  events = [];
  revocations = [];
  for (const id of ["admin", "owner", "p1", "p2"])
    await db.user.create({ data: { id, clerkUserId: `user_${id}` } });
  const article = await db.wikiArticle.create({ data: { title: "Page", wikitext: "" } });
  await db.wikiRevision.create({
    data: { id: "r1", articleId: article.id, author: "Old name", wikitext: "", source: "ixwiki" },
  });
});

describe("request", () => {
  it("stores a pending, visible claim under the normalised name and audits it", async () => {
    const view = await service().request(actor("p1"), { name: "old_name", evidence: " my alt " });
    expect(view).toMatchObject({
      name: "Old name",
      status: "PENDING",
      visible: true,
      origin: "PLAYER",
      evidence: "my alt",
    });
    expect(await db.adminAuditLog.count({ where: { action: "WIKI_NAME_CLAIM_REQUESTED" } })).toBe(
      1
    );
  });

  it("refuses a duplicate, a taken name and an eleventh pending name", async () => {
    await service().request(actor("p1"), { name: "Old name", evidence: null });
    expect(
      await refusal(service().request(actor("p1"), { name: "Old_name", evidence: null }))
    ).toBe("ALREADY_REQUESTED");
    await service().adminLink(admin, { userId: "p2", name: "Taken", note: null, mwUserId: null });
    expect(await refusal(service().request(actor("p1"), { name: "Taken", evidence: null }))).toBe(
      "TAKEN"
    );
    for (let i = 1; i < MAX_PENDING_CLAIMS; i++)
      await service().request(actor("p1"), { name: `Alt ${i}`, evidence: null });
    expect(
      await refusal(service().request(actor("p1"), { name: "One more", evidence: null }))
    ).toBe("TOO_MANY_PENDING");
  });
});

describe("approve", () => {
  it("tags the name's revisions, records the decider, passes rights only for a system owner, then runs the hook", async () => {
    const claim = await service().request(actor("p1"), { name: "Old name", evidence: null });
    const view = await service().approve(admin, { claimId: claim.id, note: "Checked" });
    expect(view).toMatchObject({ status: "APPROVED", rightsPass: false, decisionNote: "Checked" });
    expect((await db.wikiRevision.findUnique({ where: { id: "r1" } }))?.authorId).toBe("p1");
    expect(events).toEqual([
      expect.objectContaining({
        claimId: claim.id,
        userId: "p1",
        name: "Old name",
        origin: "PLAYER",
      }),
    ]);
    const second = await service().request(actor("p2"), { name: "Other", evidence: null });
    expect((await service().approve(owner, { claimId: second.id, note: null })).rightsPass).toBe(
      true
    );
  });

  it("gives a name to one account only, whichever approval comes second", async () => {
    const one = await service().request(actor("p1"), { name: "Old name", evidence: null });
    const two = await service().request(actor("p2"), { name: "Old name", evidence: null });
    const results = await Promise.all([
      refusal(service().approve(admin, { claimId: one.id, note: null })),
      refusal(service().approve(owner, { claimId: two.id, note: null })),
    ]);
    expect(results.sort()).toEqual([null, "TAKEN"].sort());
    expect(await db.wikiNameClaim.count({ where: { name: "Old name", status: "APPROVED" } })).toBe(
      1
    );
  });

  it("refuses a decided claim and a non-owner admin's own claim", async () => {
    const mine = await service().request(admin, { name: "Admin alt", evidence: null });
    expect(await refusal(service().approve(admin, { claimId: mine.id, note: null }))).toBe(
      "NOT_ALLOWED"
    );
    await service().reject(owner, { claimId: mine.id, note: "No" });
    expect(await refusal(service().approve(owner, { claimId: mine.id, note: null }))).toBe(
      "NOT_PENDING"
    );
  });

  it("keeps the approval when a hook throws", async () => {
    const claim = await service().request(actor("p1"), { name: "Old name", evidence: null });
    const failing = createNameClaimService(db, {
      hooks: [
        async () => {
          throw new Error("pay failed");
        },
      ],
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(failing.approve(admin, { claimId: claim.id, note: null })).resolves.toMatchObject({
      status: "APPROVED",
    });
  });
});

describe("revoke and re-approve", () => {
  it("undoes the tags, and a later approval for another account re-tags them for that account", async () => {
    const wrong = await service().request(actor("p1"), { name: "Old name", evidence: null });
    await service().approve(admin, { claimId: wrong.id, note: null });
    await service().revoke(admin, { claimId: wrong.id, note: "Wrong person" });
    expect((await db.wikiRevision.findUnique({ where: { id: "r1" } }))?.authorId).toBeNull();
    await service().adminLink(admin, { userId: "p2", name: "Old name", note: null, mwUserId: 42 });
    expect((await db.wikiRevision.findUnique({ where: { id: "r1" } }))?.authorId).toBe("p2");
    expect(await refusal(service().revoke(admin, { claimId: wrong.id, note: null }))).toBe(
      "NOT_APPROVED"
    );
  });
});

describe("adminLink", () => {
  it("approves the account's own pending claim instead of adding a second row, and is a no-op when already held", async () => {
    await service().request(actor("p1"), { name: "Old name", evidence: null });
    await service().adminLink(admin, {
      userId: "p1",
      name: "old_name",
      note: null,
      mwUserId: null,
    });
    await service().adminLink(admin, {
      userId: "p1",
      name: "Old name",
      note: null,
      mwUserId: null,
    });
    expect(await db.wikiNameClaim.count({ where: { userId: "p1" } })).toBe(1);
    expect(events).toHaveLength(1);
  });
});

describe("setVisibility", () => {
  it("lets only the owner hide or show a claim", async () => {
    const claim = await service().request(actor("p1"), { name: "Old name", evidence: null });
    expect(
      (await service().setVisibility(actor("p1"), { claimId: claim.id, visible: false })).visible
    ).toBe(false);
    expect(
      await refusal(service().setVisibility(actor("p2"), { claimId: claim.id, visible: true }))
    ).toBe("NOT_FOUND");
  });
});

describe("the system-owner rule", () => {
  it("lets a system owner approve and link their own names, and passes rights only with their decision", async () => {
    const mine = await service().request(owner, { name: "Owner alt", evidence: null });
    expect(await service().approve(owner, { claimId: mine.id, note: null })).toMatchObject({
      status: "APPROVED",
      rightsPass: true,
    });
    expect(
      (
        await service().adminLink(owner, {
          userId: "owner",
          name: "Owner other",
          note: null,
          mwUserId: null,
        })
      ).rightsPass
    ).toBe(true);
    expect(
      await refusal(
        service().adminLink(admin, {
          userId: "admin",
          name: "Admin alt",
          note: null,
          mwUserId: null,
        })
      )
    ).toBe("NOT_ALLOWED");
    expect(
      (await service().adminLink(admin, { userId: "p1", name: "Linked", note: null, mwUserId: 7 }))
        .rightsPass
    ).toBe(false);
    expect(await db.wikiNameClaim.count({ where: { userId: "admin" } })).toBe(0);
  });
});

describe("locks, hooks and audit", () => {
  it("takes the name's lock before any write, in every write", async () => {
    const lockedFirst = async (work: () => Promise<object>) => {
      db.store.log = [];
      await work();
      expect(db.store.log[0]).toEqual({ kind: "advisory", ns: 41103, key: "ixwiki:Old name" });
      expect(db.store.log.some((e) => e.kind === "write")).toBe(true);
    };
    const s = service();
    let id = "";
    await lockedFirst(
      async () => ({ id } = await s.request(actor("p1"), { name: "old_name", evidence: null }))
    );
    await lockedFirst(() => s.setVisibility(actor("p1"), { claimId: id, visible: false }));
    await lockedFirst(() => s.approve(admin, { claimId: id, note: null }));
    await lockedFirst(() => s.revoke(admin, { claimId: id, note: null }));
    const other = await s.request(actor("p2"), { name: "Old name", evidence: null });
    await lockedFirst(() => s.reject(admin, { claimId: other.id, note: null }));
    await lockedFirst(() =>
      s.adminLink(admin, { userId: "p2", name: "Old_name", note: null, mwUserId: null })
    );
  });

  it("runs the hook only after the approval commits, with the decision time and the link's origin", async () => {
    const order: string[] = [];
    const transaction = db.$transaction.bind(db);
    jest
      .spyOn(db, "$transaction")
      .mockImplementation(((...args: Parameters<typeof transaction>) =>
        transaction(...args).finally(() => order.push("commit"))) as typeof transaction);
    const at = new Date("2026-10-23T12:00:00Z");
    const linking = createNameClaimService(db, {
      now: () => at,
      hooks: [
        async (e) => {
          order.push("hook");
          events.push(e);
        },
      ],
    });
    await linking.adminLink(admin, { userId: "p1", name: "Old name", note: null, mwUserId: null });
    expect(order).toEqual(["commit", "hook"]);
    expect(events).toEqual([
      expect.objectContaining({ origin: "ADMIN_LINK", approvedAt: at, source: "ixwiki" }),
    ]);
  });

  it("runs no approval hook on a reject or a revoke, and no revoke hook on a reject", async () => {
    const one = await service().request(actor("p1"), { name: "Old name", evidence: null });
    await service().reject(admin, { claimId: one.id, note: null });
    expect(revocations).toEqual([]);
    const two = await service().adminLink(admin, {
      userId: "p2",
      name: "Other",
      note: null,
      mwUserId: null,
    });
    events = [];
    await service().revoke(admin, { claimId: two.id, note: null });
    expect(events).toEqual([]);
  });

  it("runs the revoke hooks only after the revoke commits, with the former owner and the decision time", async () => {
    const held = await service().adminLink(admin, {
      userId: "p1",
      name: "Old name",
      note: null,
      mwUserId: null,
    });
    const order: string[] = [];
    const transaction = db.$transaction.bind(db);
    jest
      .spyOn(db, "$transaction")
      .mockImplementation(((...args: Parameters<typeof transaction>) =>
        transaction(...args).finally(() => order.push("commit"))) as typeof transaction);
    const at = new Date("2026-10-23T12:00:00Z");
    const revoking = createNameClaimService(db, {
      now: () => at,
      revokedHooks: [
        async (e) => {
          order.push("hook");
          revocations.push(e);
        },
      ],
    });
    await revoking.revoke(admin, { claimId: held.id, note: null });
    expect(order).toEqual(["commit", "hook"]);
    expect(revocations).toEqual([
      { claimId: held.id, userId: "p1", source: "ixwiki", name: "Old name", revokedAt: at },
    ]);
  });

  it("keeps the revoke when a revoke hook throws", async () => {
    const held = await service().adminLink(admin, {
      userId: "p1",
      name: "Old name",
      note: null,
      mwUserId: null,
    });
    const failing = createNameClaimService(db, {
      revokedHooks: [
        async () => {
          throw new Error("take-back failed");
        },
      ],
    });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(failing.revoke(admin, { claimId: held.id, note: null })).resolves.toMatchObject({
      status: "REVOKED",
    });
  });

  it("writes one audit row per decision with the decider, the rights flag and the tag counts", async () => {
    const claim = await service().request(actor("p1"), { name: "Old name", evidence: null });
    await service().approve(owner, { claimId: claim.id, note: " Checked " });
    await service().revoke(admin, { claimId: claim.id, note: null });
    await service().adminLink(admin, { userId: "p2", name: "Old name", note: null, mwUserId: 42 });
    const rows = await db.adminAuditLog.findMany({ orderBy: { timestamp: "asc" } });
    expect(rows.map((r) => r.action).sort()).toEqual(
      [
        "WIKI_NAME_CLAIM_REQUESTED",
        "WIKI_NAME_CLAIM_APPROVED",
        "WIKI_NAME_CLAIM_REVOKED",
        "WIKI_NAME_LINKED",
      ].sort()
    );
    const by = (action: string) => rows.find((r) => r.action === action)!;
    expect(by("WIKI_NAME_CLAIM_APPROVED")).toMatchObject({
      targetType: "wiki_name_claim",
      targetId: claim.id,
      targetName: "Old name",
      adminId: "owner",
      adminName: "user_owner",
    });
    expect(JSON.parse(by("WIKI_NAME_CLAIM_APPROVED").changes)).toMatchObject({
      userId: "p1",
      rightsPass: true,
      tagged: 1,
      note: "Checked",
    });
    expect(JSON.parse(by("WIKI_NAME_CLAIM_REVOKED").changes)).toMatchObject({ untagged: 1 });
    expect(JSON.parse(by("WIKI_NAME_LINKED").changes)).toMatchObject({
      userId: "p2",
      rightsPass: false,
      tagged: 1,
      mwUserId: 42,
    });
    expect(await db.wikiNameClaim.findFirst({ where: { userId: "p2" } })).toMatchObject({
      origin: "ADMIN_LINK",
      requestedById: "admin",
      mwUserId: 42,
    });
  });
});

describe("revision authors", () => {
  it("never touches a revision that already had an author, through approve, revoke and re-link", async () => {
    const article = await db.wikiArticle.findFirst();
    await db.wikiRevision.create({
      data: {
        id: "r2",
        articleId: article!.id,
        author: "Old_name",
        authorId: "admin",
        wikitext: "",
        source: "ixwiki",
      },
    });
    const claim = await service().request(actor("p1"), { name: "Old name", evidence: null });
    await service().approve(owner, { claimId: claim.id, note: null });
    await service().revoke(owner, { claimId: claim.id, note: null });
    await service().adminLink(owner, {
      userId: "p2",
      name: "Old name",
      note: null,
      mwUserId: null,
    });
    expect((await db.wikiRevision.findUnique({ where: { id: "r2" } }))?.authorId).toBe("admin");
  });
});

describe("refusals", () => {
  it("refuses an impossible name with the resolver's message", async () => {
    const error = await service()
      .request(actor("p1"), { name: "a|b", evidence: null })
      .catch((e: NameClaimError) => e);
    expect(error).toMatchObject({
      code: "INVALID_NAME",
      message: "A wiki name cannot contain # < > [ ] | { }.",
    });
    expect(
      await refusal(
        service().adminLink(admin, { userId: "p1", name: " ", note: null, mwUserId: null })
      )
    ).toBe("INVALID_NAME");
  });

  it("refuses to link a name another account holds, to reject a decided claim, or to hide a decided one", async () => {
    const held = await service().adminLink(admin, {
      userId: "p2",
      name: "Old name",
      note: null,
      mwUserId: null,
    });
    expect(
      await refusal(
        service().adminLink(admin, { userId: "p1", name: "old_name", note: null, mwUserId: null })
      )
    ).toBe("TAKEN");
    expect(await refusal(service().reject(admin, { claimId: held.id, note: null }))).toBe(
      "NOT_PENDING"
    );
    await service().revoke(admin, { claimId: held.id, note: null });
    expect(
      await refusal(service().setVisibility(actor("p2"), { claimId: held.id, visible: false }))
    ).toBe("NOT_PENDING");
    expect(await refusal(service().approve(admin, { claimId: "missing", note: null }))).toBe(
      "NOT_FOUND"
    );
  });

  it("refuses to approve or link a name another account's handle spells, but not the claimant's own", async () => {
    // MediaWiki normalises the handle: underscores are spaces, runs of them one, the first letter upper case
    await db.user.update({ where: { id: "p2" }, data: { handle: "old__name_" } });
    const claim = await service().request(actor("p1"), { name: "Old name", evidence: null });
    const link = (name: string) =>
      service().adminLink(owner, { userId: "p1", name, note: null, mwUserId: null });

    expect(await refusal(service().approve(admin, { claimId: claim.id, note: null }))).toBe(
      "HANDLE_TAKEN"
    );
    expect(await refusal(link("Old_name"))).toBe("HANDLE_TAKEN");
    await db.user.update({ where: { id: "p2" }, data: { handle: "fresh_name" } });
    expect(await refusal(link("Fresh name"))).toBe("HANDLE_TAKEN");
    expect((await db.wikiNameClaim.findMany({})).map((c) => [c.name, c.status])).toEqual([
      ["Old name", "PENDING"],
    ]);
    await expect(
      service().approve(admin, { claimId: claim.id, note: null })
    ).resolves.toMatchObject({ status: "APPROVED" });

    // A handle that only starts like the name, and the claimant's own handle, are no obstacle
    await db.user.update({ where: { id: "p2" }, data: { handle: "second_names" } });
    await db.user.update({ where: { id: "p1" }, data: { handle: "second_name" } });
    await expect(link("Second name")).resolves.toMatchObject({ status: "APPROVED" });
  });

  it("uses the exact UI copy and maps each refusal to its tRPC code", async () => {
    const claim = await service().request(actor("p1"), { name: "Old name", evidence: null });
    await expect(
      service().request(actor("p1"), { name: "Old name", evidence: null })
    ).rejects.toThrow("You already hold or asked for this name.");
    await service().approve(admin, { claimId: claim.id, note: null });
    await expect(
      service().request(actor("p2"), { name: "Old name", evidence: null })
    ).rejects.toThrow("That name already belongs to another account.");
    const http: Record<NameClaimErrorCode, string> = {
      INVALID_NAME: "BAD_REQUEST",
      TAKEN: "CONFLICT",
      ALREADY_REQUESTED: "BAD_REQUEST",
      TOO_MANY_PENDING: "BAD_REQUEST",
      NOT_FOUND: "NOT_FOUND",
      NOT_PENDING: "BAD_REQUEST",
      NOT_APPROVED: "BAD_REQUEST",
      NOT_ALLOWED: "FORBIDDEN",
      HANDLE_TAKEN: "CONFLICT",
    };
    for (const [code, trpcCode] of Object.entries(http)) {
      expect(() =>
        toNameClaimTrpcError(new NameClaimError(code as NameClaimErrorCode, `why ${code}`))
      ).toThrow(expect.objectContaining({ code: trpcCode, message: `why ${code}` }));
    }
  });

  it("passes any other error through as it is", async () => {
    const other = new Error("boom");
    await expect(Promise.reject(other).catch(toNameClaimTrpcError)).rejects.toBe(other);
  });
});

describe("listMine", () => {
  it("lists every status of the account's claims, newest first", async () => {
    const a = await service().request(actor("p1"), { name: "First", evidence: null });
    await service().reject(admin, { claimId: a.id, note: null });
    await db.wikiNameClaim.update({ where: { id: a.id }, data: { createdAt: new Date(0) } });
    const b = await service().request(actor("p1"), { name: "Second", evidence: null });
    await service().request(actor("p2"), { name: "Not mine", evidence: null });
    expect((await service().listMine("p1")).map((c) => [c.id, c.status])).toEqual([
      [b.id, "PENDING"],
      [a.id, "REJECTED"],
    ]);
  });
});
