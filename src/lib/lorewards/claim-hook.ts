/**
 * What a wiki name claim does to the name's Loreward places (design decisions 6, 7 and 19, and the owner's decision of
 * 2026-10-23 on revokes). The claims service runs these after its commit, outside every lock
 * (`src/lib/identity/claim-hooks.ts`).
 */
import type { ClaimApprovedHook, ClaimRevokedHook } from "~/lib/identity/claim-hooks";
import { db } from "~/server/db";
import { entryIdsOfName, settleLorewardPlaces } from "./settle";
import { grantUnownedTrophyCards, takeBackTrophyCards } from "./trophy-cards";

/**
 * After a claim on `event.name` is approved or linked: settle the contests that record the name (design decision 6).
 * Places from LOREWARD_PAYOUT_START pay once; every place's trophy card, back to 2017, is minted and given, and a card
 * a revoke took back moves to the new owner. Idempotent: a place paid before (to anyone) is never paid again, so a
 * re-approval after a revoke pays nothing.
 */
export const lorewardsClaimHook: ClaimApprovedHook = async (event) => {
  const { paid, minted, granted } = await settleLorewardPlaces({
    entryIds: await entryIdsOfName(db, event.name),
  });
  if (paid + minted + granted > 0) {
    console.log(
      `[Lorewards] claim ${event.claimId} (${event.name}): paid ${paid}, minted ${minted}, granted ${granted}`
    );
  }
};

/**
 * After a claim on `event.name` is revoked: the name's trophy cards go back from the former owner to the name, owned
 * by no account (`takeBackTrophyCards`), then to the name's owner when it has one again (an approval that committed
 * before this hook ran found the cards still held). The IxC paid stays paid (design decision 7). Idempotent.
 */
export const lorewardsRevokeHook: ClaimRevokedHook = async (event) => {
  const entryIds = await entryIdsOfName(db, event.name);
  const { taken } = await takeBackTrophyCards(db, entryIds, event.userId);
  const { granted } = await grantUnownedTrophyCards(db, entryIds);
  if (taken + granted > 0) {
    console.log(
      `[Lorewards] claim ${event.claimId} (${event.name}) revoked: took back ${taken}, granted ${granted}`
    );
  }
};
