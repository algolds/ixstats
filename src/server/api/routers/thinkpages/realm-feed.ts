/**
 * The realm filter of the ThinkPages feed: public posts by personas whose nation is in the realm. The realm's board
 * is no longer read here: its messages are native forum posts, shown by the feed's board block (RealmFeed ->
 * RealmBoardBlock), and the old ThinkTank board chat stays in its tables until the owner has run the history import
 * on production (its removal is a later, owner-gated cleanup).
 */
import type { Prisma } from "@prisma/client";

export function realmFeedWhere(realmId: string): Prisma.ThinkpagesPostWhereInput {
  return { visibility: "public", account: { country: { realmId } } };
}
