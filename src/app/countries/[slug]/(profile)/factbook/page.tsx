import { redirect } from "next/navigation";

/**
 * `/countries/[slug]/factbook`: the old Factbook index. The Factbook is now the country's own
 * URL, which opens on the overview, so this address redirects there (Next adds the base path).
 * The section routes (`/factbook/economy`, ...) are unchanged.
 */
export default async function FactbookIndexRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/countries/${slug}`);
}
