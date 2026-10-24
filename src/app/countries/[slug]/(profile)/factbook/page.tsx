import { redirect } from "next/navigation";
import { legacyCountryRedirect } from "~/lib/country/country-routes";

/** `/countries/[slug]/factbook`: an old address; the Factbook is the country's own URL now. */
export default async function LegacyFactbookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(legacyCountryRedirect(slug, ["factbook"]));
}
