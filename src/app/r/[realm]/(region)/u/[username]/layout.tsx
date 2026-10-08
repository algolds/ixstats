import type { Metadata } from "next";
import type { ReactNode } from "react";
import { passportIndexable } from "~/server/modules/identity/identity.link-privacy";

interface RealmPassportLayoutProps {
  children: ReactNode;
  params: Promise<{ realm: string; username: string }>;
}

/**
 * The realm passport carries the passport's indexing rule (SL-4): `noindex, nofollow` when the holder
 * turned "Search engine indexing" off. `/r/{realm}/@handle` rewrites to this route.
 */
export async function generateMetadata({
  params,
}: Pick<RealmPassportLayoutProps, "params">): Promise<Metadata> {
  const { username } = await params;
  const handle = decodeURIComponent(username).replace(/^@/, "");
  return (await passportIndexable(handle)) ? {} : { robots: { index: false, follow: false } };
}

export default function RealmPassportLayout({ children }: RealmPassportLayoutProps) {
  return children;
}
