import type { Metadata } from "next";
import type { ReactNode } from "react";
import { passportSegmentHandleOrRaw } from "~/lib/passport/passport-segment";
import { passportPageMetadata } from "~/server/modules/identity/identity.metadata";

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
  return passportPageMetadata(passportSegmentHandleOrRaw(username));
}

export default function PassportLayout({ children }: PassportLayoutProps) {
  return children;
}
