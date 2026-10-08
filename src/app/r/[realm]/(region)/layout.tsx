import type { Metadata } from "next";
import type { ReactNode } from "react";
import { orNullLogged } from "~/lib/site-metadata";
import { db } from "~/server/db";
import { loadRealmMetadataSource, realmMetadata } from "~/server/modules/realms";
import { RegionLayoutClient } from "./RegionLayoutClient";

interface RealmRegionLayoutProps {
  children: ReactNode;
  params: Promise<{ realm: string }>;
}

/**
 * Link unfurls (Discord, Slack) and search engines read the realm's name and a short description
 * from here; the card image comes from `opengraph-image.tsx`. No canonical: every page below inherits
 * this. Draft and unknown realms add nothing beyond the root defaults.
 */
export async function generateMetadata({
  params,
}: Pick<RealmRegionLayoutProps, "params">): Promise<Metadata> {
  const { realm: slug } = await params;
  return realmMetadata(await orNullLogged(loadRealmMetadataSource(db, slug), `realm ${slug}`));
}

export default function RealmRegionLayout({ params, children }: RealmRegionLayoutProps) {
  return <RegionLayoutClient params={params}>{children}</RegionLayoutClient>;
}
