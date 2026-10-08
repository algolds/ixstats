import { orNullLogged, siteMetadataBase } from "~/lib/site-metadata";
import { db } from "~/server/db";
import { loadRealmMetadataSource } from "~/server/modules/realms";
import { fetchOgImage, loadOgSeal } from "./og-assets.server";
import { realmOgModel } from "./og-models";
import { ogImageResponse } from "./og-response.server";
import { RealmOgCard } from "./RealmOgCard";

/**
 * The realm link card for `slug`: banner, name, counts and the join call. A draft, generating or
 * unknown realm, or a failed read, gives the generic card, so nothing about an unpublished realm
 * leaks. Drawn by the `(region)` pages' metadata image and by the stable `/r/{slug}/opengraph-image`.
 */
export async function realmOgImage(slug: string) {
  const source = await orNullLogged(loadRealmMetadataSource(db, slug), `og image realm ${slug}`);
  const model = realmOgModel(source);
  const [seal, banner] = await Promise.all([
    loadOgSeal(),
    fetchOgImage(model.bannerUrl, siteMetadataBase()),
  ]);
  return ogImageResponse(<RealmOgCard model={model} images={{ seal, banner }} />);
}
