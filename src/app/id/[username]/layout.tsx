import type { Metadata } from "next";
import type { ReactNode } from "react";
import { passportIndexable } from "~/server/modules/identity/identity.link-privacy";

interface PassportLayoutProps {
  children: ReactNode;
  params: Promise<{ username: string }>;
}

/**
 * Search-engine indexing (SL-4): a passport whose holder turned "Search engine indexing" off is
 * served with `noindex, nofollow`. `/@handle` rewrites to this route, so both URLs carry it.
 */
export async function generateMetadata({
  params,
}: Pick<PassportLayoutProps, "params">): Promise<Metadata> {
  const { username } = await params;
  const handle = decodeURIComponent(username).replace(/^@/, "");
  return (await passportIndexable(handle)) ? {} : { robots: { index: false, follow: false } };
}

export default function PassportLayout({ children }: PassportLayoutProps) {
  return children;
}
