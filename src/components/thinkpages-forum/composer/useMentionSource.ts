"use client";

import { useMemo, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import type { MentionSource } from "~/components/shared/editor/mention-source";
import { useUser } from "~/context/auth-context";
import { useDebounce } from "~/hooks/useDebounce";
import { MENTION_NAME_MAX, MENTION_SUGGEST_MIN } from "~/lib/thinkpages-forum/mentions";
import { api } from "~/trpc/react";

const NONE: MentionSource["items"] = [];
const TYPABLE = /^[a-z0-9_]+$/;

/**
 * The @ menu of the forum's light composers (spec section 5): Passport handles and public personas from
 * `mentionSuggestions`, asked 200 ms after the last keystroke, only for a signed-in member and a query the server
 * would accept (2 to 24 letters, digits or underscores). Signed-out visitors cannot post, so ask nothing for them.
 */
export function useMentionSource(): MentionSource {
  const { isSignedIn } = useUser();
  const [typed, setTyped] = useState("");
  const query = useDebounce(typed.trim().replace(/^@/, "").toLowerCase(), 200);
  const usable =
    query.length >= MENTION_SUGGEST_MIN && query.length <= MENTION_NAME_MAX && TYPABLE.test(query);
  const { data, isFetching } = api.thinkpagesForum.mentionSuggestions.useQuery(
    { q: query },
    {
      enabled: isSignedIn === true && usable,
      staleTime: 30_000,
      placeholderData: keepPreviousData,
      refetchOnWindowFocus: false,
    }
  );
  return useMemo(
    () => ({
      items: usable && data ? data : NONE,
      isLoading: usable && isFetching,
      onQueryChange: setTyped,
    }),
    [usable, data, isFetching]
  );
}
