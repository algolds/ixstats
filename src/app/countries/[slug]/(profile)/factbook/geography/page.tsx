import { redirect } from "next/navigation";
import { legacyCountryRedirect } from "~/lib/country/country-routes";

/** `/countries/[slug]/factbook/geography`: an old address; its content lives on the country document now. */
export default async function LegacyFactbookGeographyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(legacyCountryRedirect(slug, ["factbook", "geography"]));
}
