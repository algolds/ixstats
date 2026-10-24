/**
 * The claim hooks (the plan B interface): what runs once a wiki name claim is approved or admin-linked, and once an
 * approved claim is revoked.
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

/** An approved claim taken back: `userId` is the account that held the name. */
export interface ClaimRevokedEvent {
  claimId: string;
  userId: string;
  source: WikiNameSource;
  /** The claimed name, normalised (claimName). */
  name: string;
  revokedAt: Date;
}

export type ClaimRevokedHook = (event: ClaimRevokedEvent) => Promise<void>;

/**
 * Run, in order, after a claim approval or admin link commits: outside every transaction and lock, so a hook may take
 * the vault and card locks itself. A hook must be idempotent (an approval can be retried after a crash between commit
 * and hooks; plan B's syncs pay the same places again safely). The conversion and the tag backfill run no hooks: plan
 * B's payout runs in every sync. Lorewards pays and mints the name's places here (src/lib/lorewards/claim-hook.ts),
 * loaded only on an approval so the identity module does not load the card and vault code.
 */
export const CLAIM_APPROVED_HOOKS: readonly ClaimApprovedHook[] = [
  async (event) => (await import("~/lib/lorewards/claim-hook")).lorewardsClaimHook(event),
];

/**
 * Run, in order, after a revoke commits, outside every transaction and lock; idempotent, as the approval hooks are.
 * Lorewards takes the name's trophy cards back from the account (src/lib/lorewards/claim-hook.ts); the IxC it was
 * paid stays paid (design decision 7).
 */
export const CLAIM_REVOKED_HOOKS: readonly ClaimRevokedHook[] = [
  async (event) => (await import("~/lib/lorewards/claim-hook")).lorewardsRevokeHook(event),
];

/** Each hook in turn; a hook that throws is logged under `label` and the next one still runs. */
async function runEach<E>(
  event: E,
  hooks: ReadonlyArray<(event: E) => Promise<void>>,
  label: string
): Promise<void> {
  for (const hook of hooks) {
    try {
      await hook(event);
    } catch (error) {
      console.error(label, error);
    }
  }
}

/** Each hook in turn; a hook that throws is logged ("[identity] claim hook failed") and the next one still runs. */
export function runClaimApprovedHooks(
  event: ClaimApprovedEvent,
  hooks: readonly ClaimApprovedHook[] = CLAIM_APPROVED_HOOKS
): Promise<void> {
  return runEach(event, hooks, "[identity] claim hook failed");
}

/** Each hook in turn; one that throws is logged ("[identity] claim revoke hook failed") and the next still runs. */
export function runClaimRevokedHooks(
  event: ClaimRevokedEvent,
  hooks: readonly ClaimRevokedHook[] = CLAIM_REVOKED_HOOKS
): Promise<void> {
  return runEach(event, hooks, "[identity] claim revoke hook failed");
}
