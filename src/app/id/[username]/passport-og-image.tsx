import { fetchOgImage, loadOgSeal } from "~/lib/og/og-assets.server";
import { passportOgModel } from "~/lib/og/og-models";
import { ogImageResponse } from "~/lib/og/og-response.server";
import { PassportOgCard } from "~/lib/og/PassportOgCard";
import { orNullLogged, siteMetadataBase } from "~/lib/site-metadata";
import { getPassportCard } from "~/server/modules/identity/identity.service";

/**
 * The passport link card for a `[username]` segment, as an anonymous visitor would see the passport:
 * `/@handle` (rewritten to `/id/handle`) and the realm passport `/r/{realm}/@handle` both draw it.
 * An unknown handle, previews turned off or a failed read give the generic IxStates Passport card.
 */
export async function passportOgImage(username: string) {
  const handle = decodeURIComponent(username).replace(/^@/, "");
  const card = await orNullLogged(
    getPassportCard({ handle, viewerClerkId: null }),
    `og image passport card @${handle}`
  );
  const model = passportOgModel(card);
  const origin = siteMetadataBase();
  const person = model.kind === "passport" ? model : null;
  const [seal, avatar, flag] = await Promise.all([
    loadOgSeal(),
    fetchOgImage(person?.avatarUrl, origin),
    fetchOgImage(person?.nation?.flagUrl, origin),
  ]);
  return ogImageResponse(<PassportOgCard model={model} images={{ seal, avatar, flag }} />);
}
