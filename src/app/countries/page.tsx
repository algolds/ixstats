import { redirect } from "next/navigation";
import { api } from "~/trpc/server";
import { IXNAY_SLUG } from "~/lib/realms/realm-ids";

/** The active nation's realm, else Ixnay (signed out, or no nation). */
async function viewerRealmSlug(): Promise<string> {
  const mine = await api.realms.myNations().catch(() => null);
  const active = mine?.realms.find((r) => r.nations.some((n) => n.id === mine.activeCountryId));
  return active?.slug ?? IXNAY_SLUG;
}

/**
 * Retired: every nation belongs to a realm, so the nation list is the realm's Nations tab. `?realm=<slug>`
 * goes to that realm's; without it, the viewer's realm's.
 */
export default async function CountriesPage({
  searchParams,
}: {
  searchParams: Promise<{ realm?: string }>;
}) {
  const { realm } = await searchParams;
  redirect(`/r/${encodeURIComponent(realm ?? (await viewerRealmSlug()))}/nations`);
}
