import { useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

interface DeepLinkTarget {
  clerkUserId: string;
  /** A link from a country is the secure, country-to-country channel. */
  diplomatic: boolean;
}

interface Options {
  countryId: string | null;
  userHandle: string | null;
  currentUserId: string;
  /** Opens or starts the conversation with the target; resolves when the address has moved on. */
  open: (target: DeepLinkTarget) => Promise<void>;
  /** The target could not be found: drop it from the address. */
  dismiss: () => void;
}

/**
 * Resolves `?country=<id>` (the nation's owner) and `?user=<handle>` into a person to message with
 * `messages.resolveRecipient`; each target is acted on once.
 */
export function useMessagesDeepLink({
  countryId,
  userHandle,
  currentUserId,
  open,
  dismiss,
}: Options) {
  const notify = useNotify();
  const handled = useRef<string | null>(null);
  const targetKey = countryId ? `country:${countryId}` : userHandle ? `user:${userHandle}` : null;
  const ref = countryId ? { countryId } : { handle: userHandle ?? "" };

  const recipient = api.messages.resolveRecipient.useQuery(ref, {
    enabled: !!currentUserId && !!targetKey,
    retry: false,
  });
  const settled = recipient.isSuccess || recipient.isError;

  useEffect(() => {
    if (!targetKey) {
      handled.current = null;
      return;
    }
    if (!currentUserId || !settled || handled.current === targetKey) return;
    handled.current = targetKey;

    const clerkUserId = recipient.data?.clerkUserId;
    if (!clerkUserId) {
      notify.error(
        countryId ? "No player found for that nation" : "No player found with that handle"
      );
      dismiss();
      return;
    }
    void open({ clerkUserId, diplomatic: !!countryId });
  }, [targetKey, currentUserId, settled, recipient.data, countryId, open, dismiss, notify]);
}
