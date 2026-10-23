/**
 * The claim-approval hook (the plan B interface): what runs once a wiki name claim is approved or admin-linked.
 */
import type { WikiNameSource } from "./wiki-names";

export interface ClaimApprovedEvent {
  claimId: string;
  userId: string;
  source: WikiNameSource;
  /** The claimed name, normalised (claimName). */
  name: string;
  approvedAt: Date;
  origin: "PLAYER" | "ADMIN_LINK";
}

export type ClaimApprovedHook = (event: ClaimApprovedEvent) => Promise<void>;

/**
 * Run, in order, after a claim approval or admin link commits: outside every transaction and lock, so a hook may take
 * the vault and card locks itself. A hook must be idempotent (an approval can be retried after a crash between commit
 * and hooks; plan B's syncs pay the same places again safely). The conversion and the tag backfill run no hooks: plan
 * B's payout runs in every sync. Plan B appends its payout-and-mint hook here.
 */
export const CLAIM_APPROVED_HOOKS: readonly ClaimApprovedHook[] = [];

/** Each hook in turn; a hook that throws is logged ("[identity] claim hook failed") and the next one still runs. */
export async function runClaimApprovedHooks(
  event: ClaimApprovedEvent,
  hooks: readonly ClaimApprovedHook[] = CLAIM_APPROVED_HOOKS
): Promise<void> {
  for (const hook of hooks) {
    try {
      await hook(event);
    } catch (error) {
      console.error("[identity] claim hook failed", error);
    }
  }
}
