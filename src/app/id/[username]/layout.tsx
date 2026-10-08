import type { Metadata } from "next";
import type { ReactNode } from "react";
import { passportIndexable } from "~/server/modules/identity/identity.link-privacy";
import { passportMetadata } from "~/server/modules/identity/identity.metadata";
import { getPassportCard } from "~/server/modules/identity/identity.service";

interface PassportLayoutProps {
  children: ReactNode;
  params: Promise<{ username: string }>;
}

/**
 * Search-engine indexing (SL-4): a passport whose holder turned "Search engine indexing" off is
 * served with `noindex, nofollow`. `/@handle` rewrites to this route, so both URLs carry it.
 * Link unfurls (Discord, Slack) read the title, description and og tags from the anonymous view of
 * the passport card; the card image comes from `opengraph-image.tsx`.
 */
export async function generateMetadata({
  params,
}: Pick<PassportLayoutProps, "params">): Promise<Metadata> {
  const { username } = await params;
  const handle = decodeURIComponent(username).replace(/^@/, "");
  const [indexable, card] = await Promise.all([
    passportIndexable(handle),
    getPassportCard({ handle, viewerClerkId: null }).catch(() => null),
  ]);
  return passportMetadata(card, indexable);
}

export default function PassportLayout({ children }: PassportLayoutProps) {
  return children;
}
