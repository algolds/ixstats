import { fetchOgImage, loadOgSeal } from "~/lib/og/og-assets.server";
import { realmOgModel } from "~/lib/og/og-models";
import { ogImageResponse } from "~/lib/og/og-response.server";
import { RealmOgCard } from "~/lib/og/RealmOgCard";
import { orNullLogged, siteMetadataBase } from "~/lib/site-metadata";
import { db } from "~/server/db";
import { loadRealmMetadataSource } from "~/server/modules/realms";

export const alt = "Realm on IxStates";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const revalidate = 3600;

/**
 * The `/r/{realm}` link card (and its board, nations and rules pages): banner, name, counts and the
 * join call. A draft, generating or unknown realm, or a failed read, gives the generic card, so
 * nothing about an unpublished realm leaks.
 */
export default async function Image({ params }: { params: Promise<{ realm: string }> }) {
  const { realm: slug } = await params;
  const source = await orNullLogged(loadRealmMetadataSource(db, slug), `og image realm ${slug}`);
  const model = realmOgModel(source);
  const [seal, banner] = await Promise.all([
    loadOgSeal(),
    fetchOgImage(model.bannerUrl, siteMetadataBase()),
  ]);
  return ogImageResponse(<RealmOgCard model={model} images={{ seal, banner }} />);
}
