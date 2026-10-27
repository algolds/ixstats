/**
 * ThinkTank lifecycle fixes from tester feedback:
 * - Creating a group with an emblem from the media repository failed: the picker returns
 *   site-relative paths (Commons proxy, downloaded IxWiki images, stash), which
 *   `z.string().url()` rejected.
 * - A group whose last member leaves is disbanded (archived via isActive), except realm boards.
 *
 * `jest` is the ambient global because the hoisted jest.mock() factories call jest.fn() inline.
 */
jest.mock("~/lib/notifications/hooks", () => ({
  __esModule: true,
  notificationHooks: { onThinktankActivity: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/server/websocket-server", () => ({
  getThinkPagesBroadcaster: () => ({ evictFromRoom: jest.fn() }),
}));

import { describe, it, expect } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { thinkpagesThinktanksRouter } from "~/server/api/routers/thinkpages/thinktanks";
import { imageUrlSchema } from "~/server/shared/image-url-schema";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const createCaller = createCallerFactory(thinkpagesThinktanksRouter);
const ME = "user_me";

function callerFor(db: ReturnType<typeof createMockPrisma>) {
  return createCaller(
    createMockRouterContext({
      auth: { userId: ME },
      user: { id: `db_${ME}`, clerkUserId: ME, isActive: true },
      db,
    }) as never
  );
}

// What MediaSearchModal hands back for each repository source
const REPOSITORY_URLS = [
  "/projects/ixstats/api/mediawiki/commons/Special:Filepath/Flag_of_Europe.svg",
  "/projects/ixstats/images/downloaded/1730000000000-emblem.png",
  "/projects/ixstats/api/uploads/stash/abc123.webp",
  "https://upload.wikimedia.org/wikipedia/commons/b/b7/Flag_of_Europe.svg",
  "https://ixwiki.com/images/8/88/Thinkpages_Logo.svg",
];

describe("imageUrlSchema", () => {
  it.each(REPOSITORY_URLS)("accepts repository image %s", (url) => {
    expect(imageUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each(["javascript:alert(1)", "//evil.example/x.png", "/\\evil.example", "not a url", ""])(
    "rejects %s",
    (url) => {
      expect(imageUrlSchema.safeParse(url).success).toBe(false);
    }
  );
});

describe("createThinktank with a repository emblem", () => {
  it.each(REPOSITORY_URLS)("creates the group with avatar %s", async (avatar) => {
    const db = createMockPrisma();
    db.thinkshareConversation.create.mockResolvedValue({ id: "conv1" });
    db.thinktankGroup.create.mockImplementation(async ({ data }: any) => ({ id: "g1", ...data }));

    await callerFor(db).createThinktank({ name: "Economists", avatar });

    expect(db.thinktankGroup.create.mock.calls[0][0].data.avatar).toBe(avatar);
    expect(db.thinkshareConversation.create.mock.calls[0][0].data.avatar).toBe(avatar);
  });
});

describe("leaveThinktank disbands an empty group", () => {
  function makeDb(type: string, remaining: number) {
    const db = createMockPrisma();
    db.thinktankMember.findUnique.mockResolvedValue({
      id: "m1",
      userId: ME,
      role: "owner",
      isActive: true,
    });
    db.thinktankMember.count.mockResolvedValue(remaining);
    db.thinktankMember.findMany.mockResolvedValue([]);
    db.thinktankGroup.update.mockResolvedValue({ name: "G", type, conversationId: null });
    return db;
  }

  it("archives the group when the last member leaves", async () => {
    const db = makeDb("public", 0);
    const result = await callerFor(db).leaveThinktank({ groupId: "g1" });

    expect(result.disbanded).toBe(true);
    expect(db.thinktankGroup.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { isActive: false, memberCount: 0 },
    });
    expect(db.thinktankGroup.delete).not.toHaveBeenCalled();
  });

  it("keeps the group when members remain", async () => {
    const db = makeDb("public", 2);
    db.thinktankMember.findUnique.mockResolvedValue({
      id: "m1",
      userId: ME,
      role: "member",
      isActive: true,
    });
    const result = await callerFor(db).leaveThinktank({ groupId: "g1" });

    expect(result.disbanded).toBe(false);
    expect(db.thinktankGroup.update).toHaveBeenCalledTimes(1);
  });

  it("never disbands a realm board", async () => {
    const db = makeDb("realm_board", 0);
    const result = await callerFor(db).leaveThinktank({ groupId: "g1" });

    expect(result.disbanded).toBe(false);
    expect(db.thinktankGroup.update).toHaveBeenCalledTimes(1);
  });
});
