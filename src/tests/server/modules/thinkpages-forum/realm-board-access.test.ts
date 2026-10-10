/** @jest-environment node */
import { boardAccessFor } from "~/server/modules/thinkpages-forum/board-access";
import { loadForumRealm, type ForumRealm } from "~/server/modules/thinkpages-forum";
import { banRow } from "~/tests/helpers/forum-ban-fake";
import {
  admin,
  banned,
  boardStore,
  claimsOfficer,
  founder,
  member,
  officer,
  plain,
  seed,
  visitor,
} from "~/tests/helpers/forum-board-fake";

async function accessFor(who: object | null, slug = "eurth", store = boardStore()) {
  const realm = (await loadForumRealm(store.db as never, { slug })) as ForumRealm;
  return boardAccessFor(store.db as never, who as never, realm);
}

const base = {
  canRead: true,
  canPost: false,
  isMember: false,
  isVisitor: false,
  isModerator: false,
  reason: null,
  visitorRealm: null,
};

describe("boardAccessFor", () => {
  it("lets a signed-out reader read but not post, asking them to sign in", async () => {
    expect(await accessFor(null)).toMatchObject({ ...base, reason: "sign_in" });
  });

  it("lets a member (a nation in the realm) read and post", async () => {
    expect(await accessFor(member)).toMatchObject({ ...base, canPost: true, isMember: true });
  });

  it("lets a visitor (a nation in another realm) post while visitors are allowed, labelled with their own realm", async () => {
    expect(await accessFor(visitor)).toMatchObject({
      ...base,
      canPost: true,
      isVisitor: true,
      visitorRealm: { slug: "aurora", name: "Aurora" },
    });
  });

  it("treats a signed-in player with no nation as a visitor without a realm", async () => {
    expect(await accessFor(plain)).toMatchObject({
      ...base,
      canPost: true,
      isVisitor: true,
      visitorRealm: null,
    });
  });

  it("refuses visitors when the realm turned visitors off, but not members", async () => {
    const store = boardStore(
      seed({
        realms: [
          {
            id: "r_eurth",
            slug: "eurth",
            name: "Eurth",
            status: "active",
            ownerId: "founder",
            boardVisitorsAllowed: false,
            boardSlowModeSeconds: 0,
          },
          { id: "r_aurora", slug: "aurora", name: "Aurora", status: "active", ownerId: "af" },
        ],
      })
    );
    expect(await accessFor(visitor, "eurth", store)).toMatchObject({
      canRead: true,
      canPost: false,
      isVisitor: true,
      reason: "visitors_off",
    });
    expect(await accessFor(member, "eurth", store)).toMatchObject({ canPost: true });
  });

  it("refuses a banned member (realm ban), who can still read", async () => {
    const store = boardStore();
    store.state.bans.push(banRow({ userId: "u_banned", scope: "realm", scopeId: "r_eurth" }));
    expect(await accessFor(banned, "eurth", store)).toMatchObject({
      canRead: true,
      canPost: false,
      reason: "banned",
    });
  });

  it("refuses a site-banned visitor too", async () => {
    const store = boardStore();
    store.state.bans.push(banRow({ userId: "u_visitor", scope: "site" }));
    expect(await accessFor(visitor, "eurth", store)).toMatchObject({
      canPost: false,
      reason: "banned",
    });
  });

  it("treats the founder, a board officer and a site admin as moderators who can post", async () => {
    for (const who of [founder, officer, admin]) {
      expect(await accessFor(who)).toMatchObject({
        canPost: true,
        isModerator: true,
        isMember: true,
      });
    }
  });

  it("does not make a claims-only officer a moderator", async () => {
    expect(await accessFor(claimsOfficer)).toMatchObject({ isModerator: false, isVisitor: true });
  });

  it("makes an archived realm read-only for everyone but site admins", async () => {
    expect(await accessFor(member, "old")).toMatchObject({
      canRead: true,
      canPost: false,
      reason: "archived",
    });
    expect(await accessFor(visitor, "old")).toMatchObject({ canPost: false, reason: "archived" });
    expect(await accessFor(admin, "old")).toMatchObject({ canPost: true });
  });

  it("hides a draft realm from everyone but its staff", async () => {
    expect(await accessFor(member, "draft")).toMatchObject({ canRead: false, canPost: false });
    expect(await accessFor(admin, "draft")).toMatchObject({ canRead: true });
  });
});
