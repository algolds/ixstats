/**
 * Finding the one direct conversation between two people.
 */
import type { Prisma } from "@prisma/client";

/**
 * A where clause for a direct conversation of exactly `a` and `b`. `every` alone also matches a conversation
 * holding only one of them (or nobody), so each must be present and nobody else.
 */
export function directThreadWhere(
  a: string,
  b: string,
  extra: Prisma.ThinkshareConversationWhereInput = {}
): Prisma.ThinkshareConversationWhereInput {
  return {
    ...extra,
    type: "direct",
    AND: [
      { participants: { some: { userId: a } } },
      { participants: { some: { userId: b } } },
      { participants: { every: { userId: { in: [a, b] } } } },
    ],
  };
}
