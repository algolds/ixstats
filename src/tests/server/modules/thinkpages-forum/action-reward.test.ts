/** @jest-environment node */
jest.mock("~/server/modules/action-links", () => ({
  grantActionLinkRewards: jest.fn(),
}));

import { grantActionLinkRewards } from "~/server/modules/action-links";
import { rewardNewLinks } from "~/server/modules/thinkpages-forum/action-reward";

const grant = jest.mocked(grantActionLinkRewards);
const actor: { id: string; countryId: string | null } = { id: "u1", countryId: "c1" };

const SITE_GENERAL = {
  id: "cat_general",
  scope: "site",
  realmId: null,
  visibility: "public",
};
const REALM_HUB = { id: "cat_hub", scope: "realm", realmId: "r_eurth", visibility: "public" };

const realms = [
  { id: "r_eurth", slug: "eurth", name: "Eurth", status: "active", ownerId: "founder" },
  { id: "r_draft", slug: "draft", name: "Draft", status: "draft", ownerId: "u1" },
];

/** A post as the wrapper reads it: its own flags, its thread's, and the thread's category. */
const postIn = (
  category: object,
  extra: { postHidden?: boolean; threadHidden?: boolean; threadAuthor?: string | null } = {}
) => ({
  hidden: extra.postHidden ?? false,
  thread: {
    authorUserId: extra.threadAuthor ?? "u1",
    hidden: extra.threadHidden ?? false,
    category,
  },
});

function fakeDb(post: object | null) {
  return {
    forumPost: { findUnique: jest.fn(async () => post) },
    realm: {
      findUnique: jest.fn(
        async ({ where }: { where: { id?: string; slug?: string } }) =>
          realms.find((r) => r.id === where.id || r.slug === where.slug) ?? null
      ),
    },
  };
}

const paid = (post: object | null, created: readonly string[] = ["a1"], who = actor) =>
  rewardNewLinks(fakeDb(post) as never, who, "p1", created);

beforeEach(() => jest.resetAllMocks());

describe("rewardNewLinks", () => {
  it("pays the new links of a publicly readable native post and returns the amount", async () => {
    grant.mockResolvedValueOnce(5);
    const db = fakeDb(postIn(SITE_GENERAL));
    await expect(rewardNewLinks(db as never, actor, "p1", ["a1", "a2"])).resolves.toEqual({
      amount: 5,
    });
    expect(grant).toHaveBeenCalledWith(db, {
      userId: "u1",
      countryId: "c1",
      postSource: "native",
      postRef: "p1",
      activityIds: ["a1", "a2"],
    });
  });

  it("pays a post in an active realm's section and on its board", async () => {
    grant.mockResolvedValue(5);
    await expect(paid(postIn(REALM_HUB))).resolves.toEqual({ amount: 5 });
    await expect(
      paid(postIn({ ...REALM_HUB, id: "cat_board", key: "board", style: "board" }))
    ).resolves.toEqual({ amount: 5 });
  });

  it("returns null when nothing was paid", async () => {
    grant.mockResolvedValueOnce(0);
    await expect(paid(postIn(SITE_GENERAL))).resolves.toBeNull();
  });

  it("touches nothing for a post without new links", async () => {
    const db = fakeDb(postIn(SITE_GENERAL));
    await expect(rewardNewLinks(db as never, actor, "p1", [])).resolves.toBeNull();
    expect(db.forumPost.findUnique).not.toHaveBeenCalled();
    expect(grant).not.toHaveBeenCalled();
  });

  it("pays an actor with no nation nothing", async () => {
    await expect(
      paid(postIn(SITE_GENERAL), ["a1"], { id: "u1", countryId: null })
    ).resolves.toBeNull();
    expect(grant).not.toHaveBeenCalled();
  });

  it.each([
    ["a hidden post", postIn(SITE_GENERAL, { postHidden: true })],
    ["a post in a hidden thread", postIn(SITE_GENERAL, { threadHidden: true })],
    ["a post that is gone", null],
    [
      "a Reports thread, even the reporter's own",
      postIn({ ...SITE_GENERAL, visibility: "reporter_staff" }, { threadAuthor: "u1" }),
    ],
    ["a staff category", postIn({ ...SITE_GENERAL, visibility: "staff" })],
    ["a draft realm's category", postIn({ ...REALM_HUB, realmId: "r_draft" })],
    ["a draft realm's board", postIn({ ...REALM_HUB, realmId: "r_draft", style: "board" })],
    ["a realm that is gone", postIn({ ...REALM_HUB, realmId: "r_missing" })],
  ])("pays nothing for %s", async (_label, post) => {
    await expect(paid(post)).resolves.toBeNull();
    expect(grant).not.toHaveBeenCalled();
  });

  it("never throws: a failing reward step is logged and reads as no reward", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    grant.mockRejectedValueOnce(new Error("boom"));
    await expect(paid(postIn(SITE_GENERAL))).resolves.toBeNull();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("never throws: a failing read of the post reads as no reward", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const db = fakeDb(null);
    db.forumPost.findUnique.mockRejectedValueOnce(new Error("db down"));
    await expect(rewardNewLinks(db as never, actor, "p1", ["a1"])).resolves.toBeNull();
    expect(grant).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
