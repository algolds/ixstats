import { redirect } from "next/navigation";
import { legacyCountryRedirect } from "~/lib/country/country-routes";

/** `/countries/[slug]/activity`: an old address; its content lives on another tab now. */
export default async function LegacyActivityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(legacyCountryRedirect(slug, ["activity"]));
}
