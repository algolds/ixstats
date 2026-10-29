import "server-only";

import { cookies } from "next/headers";
import { PLAY_AS_COOKIE } from "~/app/admin/users/play-as-cookie";
import { getSignedInCountryId } from "~/lib/auth/signed-in-country.server";
import { signedInApi } from "~/trpc/server";

/**
 * Reads what MyCountry's data provider asks for first into this request's query cache, so the page
 * arrives with the profile, the player's country and its activity rings instead of fetching them
 * in a chain after hydration (Clerk, then the profile, then the country, then the rings). It reads
 * as the signed-in player: `api` would answer as a guest, and a guest's profile sends the player to
 * /setup. The inputs match the provider's keys in CountryDataProvider.tsx; a viewer whose effective
 * country differs (demo mode, the dev country view) misses the cache and fetches on the client, as
 * before. While staff play as another user it prefetches nothing: the server request carries no
 * play-as header, so it would answer with the staff member's own profile and country under the keys
 * the client fills for the other user. `prefetch` never throws, so a failed read leaves the client to ask.
 */
export async function prefetchMyCountry(): Promise<void> {
  if ((await cookies()).get(PLAY_AS_COOKIE)) return;
  const id = await getSignedInCountryId();
  await Promise.all([
    signedInApi.users.getProfile.prefetch(),
    id ? signedInApi.countries.getByIdWithEconomicData.prefetch({ id }) : undefined,
    id ? signedInApi.countries.getActivityRingsData.prefetch({ countryId: id }) : undefined,
  ]);
}
