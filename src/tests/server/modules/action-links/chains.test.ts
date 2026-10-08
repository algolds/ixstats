/** @jest-environment node */
jest.mock("~/lib/wiki-os/services/edit-service", () => ({ assertCanEditArticle: jest.fn(async () => undefined) }));
jest.mock("~/lib/achievements/queue", () => ({ queueAchievementCheck: jest.fn() }));

import { TRPCError } from "@trpc/server";
import { assertCanEditArticle } from "~/lib/wiki-os/services/edit-service";
import { queueAchievementCheck } from "~/lib/achievements/queue";
import { addPostToChain, reviewChain, submitChain } from "~/server/modules/action-links";

const admin = { id: "u_a", clerkUserId: "admin", countryId: "c9", role: { name: "admin", level: 10 } };
const officer = { id: "u_o", clerkUserId: "officer", countryId: "c2", role: { name: "user", level: 100 } };
const owner = { id: "u_c1", clerkUserId: "c1owner", countryId: "c1", role: { name: "user", level: 100 } };

function chainDb(chain: { status: string; countryId?: string; kind?: string }) {
  const row = { id: "s1", countryId: "c1", kind: "chain", title: "Pact", ...chain };
  return {
    storyline: {
      findFirst: jest.fn(async () => ({
        ...row,
        country: { realmId: "r1", realm: { ownerId: "founder", officers: [{ userId: "officer", powers: ["board"] }] } },
        _count: { actionLinks: 2 },
      })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    postActionLink: {
      count: jest.fn(async () => 1),
      aggregate: jest.fn(async () => ({ _max: { chainOrder: 3 } })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    user: { findFirst: jest.fn(async () => ({ clerkUserId: "c1owner" })) },
  };
}

describe("addPostToChain", () => {
  it("appends the post's links after the current last entry", async () => {
    const db = chainDb({ status: "open" });
    await addPostToChain(db as never, { countryId: "c1", storylineId: "s1", postSource: "native", postRef: "p1" });
    expect(db.postActionLink.updateMany).toHaveBeenCalledWith({
      where: { postSource: "native", postRef: "p1", countryId: "c1" },
      data: { storylineId: "s1", chainOrder: 4 },
    });
  });

  it("refuses a post with no links of this country", async () => {
    const db = chainDb({ status: "open" });
    db.postActionLink.count.mockResolvedValue(0);
    await expect(
      addPostToChain(db as never, { countryId: "c1", storylineId: "s1", postSource: "native", postRef: "p9" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses a chain that is not open", async () => {
    const db = chainDb({ status: "submitted" });
    await expect(
      addPostToChain(db as never, { countryId: "c1", storylineId: "s1", postSource: "native", postRef: "p1" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("submitChain", () => {
  it("checks the owner may edit the target page, then submits", async () => {
    const db = chainDb({ status: "open" });
    await submitChain(db as never, { user: owner }, { countryId: "c1", storylineId: "s1", wikiPageTitle: "northern pact" });
    expect(assertCanEditArticle).toHaveBeenCalledWith({ user: owner }, "Northern pact");
    expect(db.storyline.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", countryId: "c1", kind: "chain", status: "open" },
      data: { status: "submitted", wikiPageTitle: "Northern pact" },
    });
  });

  it("does not submit when the owner cannot edit the page", async () => {
    const db = chainDb({ status: "open" });
    jest.mocked(assertCanEditArticle).mockRejectedValueOnce(new TRPCError({ code: "FORBIDDEN" }));
    await expect(
      submitChain(db as never, { user: owner }, { countryId: "c1", storylineId: "s1", wikiPageTitle: "Main Page" })
    ).rejects.toBeInstanceOf(TRPCError);
    expect(db.storyline.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an empty chain", async () => {
    const db = chainDb({ status: "open" });
    db.postActionLink.count.mockResolvedValue(0);
    await expect(
      submitChain(db as never, { user: owner }, { countryId: "c1", storylineId: "s1", wikiPageTitle: "X" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("reviewChain", () => {
  const approve = { storylineId: "s1", approve: true };

  it("lets a realm officer with the board power approve, then queues achievements and the wiki write", async () => {
    const db = chainDb({ status: "submitted" });
    const onApproved = jest.fn(async () => undefined);
    await reviewChain(db as never, officer, approve, onApproved);
    expect(db.storyline.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "s1", status: "submitted" } })
    );
    expect(queueAchievementCheck).toHaveBeenCalledWith("c1owner", "c1");
    expect(onApproved).toHaveBeenCalledWith("s1");
  });

  it("forbids reviewing your own country's chain, even as admin", async () => {
    const db = chainDb({ status: "submitted" });
    await expect(reviewChain(db as never, { ...admin, countryId: "c1" }, approve, jest.fn())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("forbids a user without the board power", async () => {
    const db = chainDb({ status: "submitted" });
    await expect(
      reviewChain(db as never, { ...officer, clerkUserId: "nobody" }, approve, jest.fn())
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets only one of two concurrent approvals win", async () => {
    const db = chainDb({ status: "submitted" });
    db.storyline.updateMany.mockResolvedValueOnce({ count: 0 });
    const onApproved = jest.fn();
    jest.mocked(queueAchievementCheck).mockClear();
    await expect(reviewChain(db as never, admin, approve, onApproved)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(onApproved).not.toHaveBeenCalled();
    expect(queueAchievementCheck).not.toHaveBeenCalled();
  });

  it("returns a rejected chain to open with the note", async () => {
    const db = chainDb({ status: "submitted" });
    await reviewChain(db as never, admin, { storylineId: "s1", approve: false, note: "Needs a source" }, jest.fn());
    expect(db.storyline.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "open", reviewNote: "Needs a source" }) })
    );
  });

  it("keeps the approval when the wiki write fails", async () => {
    const db = chainDb({ status: "submitted" });
    const onApproved = jest.fn(async () => {
      throw new Error("wiki down");
    });
    await expect(reviewChain(db as never, admin, approve, onApproved)).resolves.toBeUndefined();
  });
});
