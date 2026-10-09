import type { RouterInputs, RouterOutputs } from "~/trpc/react";

/** A persona row as `thinkpages.getMyAccounts` returns it. */
export type ThinkpagesAccountItem = RouterOutputs["thinkpages"]["getMyAccounts"][number];

/** The persona creation form's state. */
export interface ThinkpagesAccountInput {
  accountType: "government" | "media" | "citizen";
  firstName: string;
  lastName: string;
  username: string;
  bio: string;
  postingFrequency: "active" | "moderate" | "low";
  politicalLean: "left" | "center" | "right";
  personality: "serious" | "casual" | "satirical";
  profileImageUrl?: string;
}

type UpdateAccountInput = RouterInputs["thinkpages"]["updateAccount"];

/** The settings an account's settings dialog edits; `accountType` is absent for a type it cannot set (personal). */
export interface AccountSettings {
  postingFrequency: NonNullable<UpdateAccountInput["postingFrequency"]>;
  politicalLean: NonNullable<UpdateAccountInput["politicalLean"]>;
  personality: NonNullable<UpdateAccountInput["personality"]>;
  accountType?: NonNullable<UpdateAccountInput["accountType"]>;
}

const FREQUENCIES = ["active", "moderate", "low"] as const;
const LEANS = ["left", "center", "right"] as const;
const PERSONALITIES = ["serious", "casual", "satirical"] as const;
const ACCOUNT_TYPES = ["government", "media", "citizen"] as const;

/** `value` when it is one of `options`, else `fallback`. */
function oneOf<T extends string, F extends T | undefined>(
  value: string,
  options: readonly T[],
  fallback: F
): T | F {
  return options.find((option) => option === value) ?? fallback;
}

/** An account row's editable settings, with stored values outside the known sets read as the defaults. */
export function accountSettingsOf(
  row: Pick<ThinkpagesAccountItem, "postingFrequency" | "politicalLean" | "personality" | "accountType">
): AccountSettings {
  return {
    postingFrequency: oneOf(row.postingFrequency, FREQUENCIES, "moderate"),
    politicalLean: oneOf(row.politicalLean, LEANS, "center"),
    personality: oneOf(row.personality, PERSONALITIES, "casual"),
    accountType: oneOf(row.accountType, ACCOUNT_TYPES, undefined),
  };
}

/** The tRPC error code a failed call carries, if any. */
export function trpcErrorCode(error: Error): string | undefined {
  return (error as Error & { data?: { code?: string } | null }).data?.code;
}

