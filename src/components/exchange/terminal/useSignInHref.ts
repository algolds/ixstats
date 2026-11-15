"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { createUrl } from "~/lib/utils/url-utils";

/** Sign-in that returns here. createUrl: the redirect is a plain URL (memory: Link href without createUrl). */
export function useSignInHref(): string {
  const pathname = usePathname();
  const query = useSearchParams()?.toString();
  const here = query ? `${pathname}?${query}` : pathname;
  return `/sign-in?redirect_url=${encodeURIComponent(createUrl(here))}`;
}
