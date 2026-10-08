"use client";

import { useSearchParams } from "next/navigation";
import { inviteVia } from "~/lib/realms/realm-invite";

/** The invite handle in the page's `?via=` (a realm invite link), or null. */
export function useInviteVia(): string | null {
  // Null outside the App Router (tests, pages without search params).
  const params: URLSearchParams | null = useSearchParams();
  return inviteVia(params?.get("via"));
}
