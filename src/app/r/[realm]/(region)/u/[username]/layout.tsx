import type { Metadata } from "next";
import type { ReactNode } from "react";
import { passportSegmentHandleOrRaw } from "~/lib/passport/passport-segment";
import { passportPageMetadata } from "~/server/modules/identity/identity.metadata";

interface RealmPassportLayoutProps {
  children: ReactNode;
  params: Promise<{ realm: string; username: string }>;
}

/**
 * The realm passport carries the passport's indexing rule (SL-4): `noindex, nofollow` when the holder
 * turned "Search engine indexing" off. `/r/{realm}/@handle` rewrites to this route. It also carries
 * the passport's own title, og tags and canonical `/@handle`, replacing the realm's from the
 * `(region)` layout, so a realm passport link unfurls as the person.
 */
export async function generateMetadata({
  params,
}: Pick<RealmPassportLayoutProps, "params">): Promise<Metadata> {
  const { username } = await params;
  return passportPageMetadata(passportSegmentHandleOrRaw(username));
}

export default function RealmPassportLayout({ children }: RealmPassportLayoutProps) {
  return children;
}
