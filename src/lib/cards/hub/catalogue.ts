import type { Prisma } from "@prisma/client";
import { UNPUBLISHED_REALM_STATUSES } from "~/lib/realms/realm-ids";

/**
 * The cards anyone may browse: approved out of review (imports wait PENDING, `Card.reviewState`), not hidden (a
 * takedown, a restricted licence or a Library hide retires the card), and homed in a published realm (a draft or
 * generating realm's name never reaches a public list).
 * Spread it and merge into its `realm`; never replace `realm`, or the published-realm term is lost.
 */
export const CATALOGUE_WHERE = {
  reviewState: "APPROVED",
  isRetired: false,
  realm: { status: { notIn: [...UNPUBLISHED_REALM_STATUSES] } },
} satisfies Prisma.CardWhereInput;
