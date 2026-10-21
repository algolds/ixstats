/**
 * The Loreward contests that pay, and the places each pays. Client-safe, unlike vault-bonus.ts (which reaches the
 * ledger), so the cards admin's payout grid reads the same lists as the payout table.
 */
export const LOREWARD_TYPES = ["daily", "weekly", "monthly"] as const;
export type LorewardType = (typeof LOREWARD_TYPES)[number];

export const LOREWARD_PLACES = ["winner", "runner-up"] as const;
export type LorewardPlace = (typeof LOREWARD_PLACES)[number];
