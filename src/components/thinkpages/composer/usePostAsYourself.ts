"use client";

import { useCallback } from "react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";

/** Account type of the one-per-user personal persona ("you", tied to no country). */
const PERSONAL_ACCOUNT_TYPE = "personal";

export function isPersonalAccount(account: { accountType?: string | null } | null | undefined) {
  return account?.accountType === PERSONAL_ACCOUNT_TYPE;
}

/**
 * Switch the composer to the caller's personal persona, creating it on first use from their
 * IxnayID (Clerk) username / name.
 */
export function usePostAsYourself(onAccountSelect?: (account: any) => void) {
  const { user } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();

  const mutation = api.thinkpages.ensurePersonalAccount.useMutation({
    onSuccess: (account) => {
      void utils.thinkpages.getMyAccounts.invalidate();
      void utils.thinkpages.getMyPersonalAccount.invalidate();
      onAccountSelect?.(account);
    },
    onError: (err) => notify.error(err.message || "Could not set up your personal account"),
  });

  const postAsYourself = useCallback(() => {
    mutation.mutate({
      username: user?.username ?? undefined,
      displayName: user?.fullName ?? user?.username ?? undefined,
    });
  }, [mutation, user?.username, user?.fullName]);

  return { postAsYourself, isPending: mutation.isPending };
}
