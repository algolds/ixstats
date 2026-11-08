/**
 * Business press from ThinkPages (spec §11a): public, top-level #business posts by a realm's media and government
 * accounts, or by a company's linked corporate account, read live, so a deleted or hidden post leaves the Exchange.
 */
jest.mock("~/lib/exchange/notify", () => ({
  notifyExchange: jest.fn(),
  sendExchangeNotices: jest.fn(),
}));

import { linkCompanyAccount, listBusinessPosts, unlinkCompanyAccount } from "~/lib/exchange/press";
import { createFakeExchangeDb, type FakeDb } from "~/tests/helpers/fake-exchange-db";

let fake: FakeDb;
let n = 0;

function account(
  id: string,
  accountType: string,
  countryId: string | null,
  clerkUserId = "c_alice",
  over = {}
) {
  return {
    id,
    accountType,
    countryId,
    clerkUserId,
    displayName: `${id} display`,
    isActive: true,
    ...over,
  };
}

function post(accountId: string, content: string, over: Record<string, unknown> = {}) {
  n++;
  return {
    id: `p${n}`,
    accountId,
    content,
    hashtags: JSON.stringify(["Business"]),
    visibility: "public",
    parentPostId: null,
    repostOfId: null,
    contentWarning: null,
    createdAt: new Date(1_000_000 + n * 1000),
    ...over,
  };
}

function setup(posts: ReturnType<typeof post>[], companyAccount: string | null = "acc_corp") {
  fake = createFakeExchangeDb({
    user: [
      { id: "alice", clerkUserId: "c_alice" },
      { id: "bob", clerkUserId: "c_bob" },
    ],
    country: [
      { id: "na", name: "Caphiria", realmId: "default" },
      { id: "far", name: "Elsewhere", realmId: "other" },
    ],
    company: [
      {
        id: "co1",
        name: "Alice Works",
        realmId: "default",
        founderId: "alice",
        hqCountryId: "na",
        status: "ACTIVE",
        thinkpagesAccountId: companyAccount,
      },
      {
        id: "co2",
        name: "Bob Steel",
        realmId: "default",
        founderId: "bob",
        hqCountryId: "na",
        status: "ACTIVE",
        thinkpagesAccountId: null,
      },
    ],
    thinkpagesAccount: [
      account("acc_gov", "government", "na"),
      account("acc_media", "media", "na"),
      account("acc_corp", "corporate", "na"),
      account("acc_corp2", "corporate", "na"),
      account("acc_far", "government", "far"),
      account("acc_off", "media", "na", "c_alice", { isActive: false }),
      account("acc_bobcorp", "corporate", "na", "c_bob"),
    ],
    thinkpagesPost: posts,
  });
}

describe("listBusinessPosts", () => {
  it("lists government, media and linked company posts with their sources", async () => {
    setup([
      post("acc_gov", "Tax cut coming #business"),
      post("acc_media", "Markets rally on the news #Business"),
      post("acc_corp", "Record quarter for Alice Works #business"),
    ]);
    const items = await listBusinessPosts(fake.client, { realmId: "default" });
    expect(items.map((i) => [i.sourceName, i.headline, i.href])).toEqual([
      ["Alice Works", "Record quarter for Alice Works", "/dashboard/post/p3"],
      ["acc_media display", "Markets rally on the news", "/dashboard/post/p2"],
      ["Caphiria", "Tax cut coming", "/dashboard/post/p1"],
    ]);
    expect(items[0]).toMatchObject({ kind: "press", companyId: "co1", prominence: "HEADLINE" });
    expect(items[2]).toMatchObject({ countryId: "na" });
    expect(
      await listBusinessPosts(fake.client, { realmId: "default", companyId: "co1" })
    ).toHaveLength(1);
    expect(
      await listBusinessPosts(fake.client, { realmId: "default", countryId: "na" })
    ).toHaveLength(3);
    expect(await listBusinessPosts(fake.client, { realmId: "default", countryId: "far" })).toEqual(
      []
    );
  });

  it("leaves out replies, reposts, warnings, private posts, inactive and unlinked accounts, other realms and untagged posts", async () => {
    setup([
      post("acc_gov", "A reply #business", { parentPostId: "x" }),
      post("acc_gov", "A repost #business", { repostOfId: "x" }),
      post("acc_gov", "Careful #business", { contentWarning: "spoilers" }),
      post("acc_gov", "Friends only #business", { visibility: "followers" }),
      post("acc_off", "Inactive #business"),
      post("acc_corp2", "Unlinked corporate #business"),
      post("acc_far", "Other realm #business"),
      post("acc_media", "Not tagged", { hashtags: JSON.stringify(["sports"]) }),
    ]);
    expect(await listBusinessPosts(fake.client, { realmId: "default" })).toEqual([]);
  });

  it("drops a post once it is deleted", async () => {
    setup([post("acc_gov", "Here today #business")]);
    expect(await listBusinessPosts(fake.client, { realmId: "default" })).toHaveLength(1);
    fake.tables.thinkpagesPost = [];
    expect(await listBusinessPosts(fake.client, { realmId: "default" })).toEqual([]);
  });
});

describe("linking a company's account", () => {
  beforeEach(() => setup([], null));

  it("links the founder's own corporate account, once", async () => {
    await linkCompanyAccount(fake.client, {
      userId: "alice",
      companyId: "co1",
      accountId: "acc_corp",
    });
    expect(fake.tables.company!.find((c) => c.id === "co1")!.thinkpagesAccountId).toBe("acc_corp");
    await unlinkCompanyAccount(fake.client, { userId: "alice", companyId: "co1" });
    expect(fake.tables.company!.find((c) => c.id === "co1")!.thinkpagesAccountId).toBeNull();
  });

  it("refuses a non-founder, a non-corporate account, someone else's account, and an account already linked", async () => {
    await expect(
      linkCompanyAccount(fake.client, { userId: "bob", companyId: "co1", accountId: "acc_corp" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      linkCompanyAccount(fake.client, { userId: "alice", companyId: "co1", accountId: "acc_media" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      linkCompanyAccount(fake.client, {
        userId: "alice",
        companyId: "co1",
        accountId: "acc_bobcorp",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    fake.tables.company!.find((c) => c.id === "co2")!.thinkpagesAccountId = "acc_corp";
    await expect(
      linkCompanyAccount(fake.client, { userId: "alice", companyId: "co1", accountId: "acc_corp" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
