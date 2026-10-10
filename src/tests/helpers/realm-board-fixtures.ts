/**
 * Board data for the realm landing tests, in the shape `thinkpagesForum.getBoard` returns (superjson: real Dates).
 */
import type { RouterOutputs } from "~/trpc/react";

type Board = RouterOutputs["thinkpagesForum"]["getBoard"];
export type FixtureMessage = Board["messages"][number];
export type FixtureAccess = Board["access"];

/** A board message by a member: "kir", twelve minutes old, no role, no reply, not continued. */
export function boardMessage(overrides: Partial<FixtureMessage> = {}): FixtureMessage {
  const id = overrides.id ?? "p1";
  return {
    id,
    authorUserId: "u_kir",
    authorPersonaId: null,
    importedAuthorName: null,
    author: {
      name: "kir",
      handle: "kir",
      avatarUrl: null,
      flagUrl: "/flags/kir.png",
      persona: false,
    },
    role: null,
    isVisitor: false,
    visitorRealm: null,
    contentHtml: `<p>Message ${id}</p>`,
    createdAt: new Date(Date.now() - 12 * 60_000),
    editedAt: null,
    byViewer: false,
    canEdit: false,
    replyTo: null,
    continued: null,
    ...overrides,
  };
}

/** A signed-in member who may post. */
export function boardAccess(overrides: Partial<FixtureAccess> = {}): FixtureAccess {
  return {
    canRead: true,
    canPost: true,
    isMember: true,
    isVisitor: false,
    isModerator: false,
    reason: null,
    notice: null,
    visitorRealm: null,
    ...overrides,
  };
}

export function boardData(
  messages: FixtureMessage[],
  overrides: Partial<Omit<Board, "messages">> = {}
): Board {
  return {
    realm: {
      id: "r_eurth",
      slug: "eurth",
      name: "Eurth",
      emblemUrl: null,
      memberCount: 31,
      settings: { visitorsAllowed: true, slowModeSeconds: 0 },
    },
    messages,
    hasMore: false,
    access: boardAccess(),
    ...overrides,
  };
}
