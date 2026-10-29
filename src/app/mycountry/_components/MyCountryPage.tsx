import { MyCountryRouter } from "~/components/mycountry";
import { HydrateClient } from "~/trpc/server";
import { prefetchMyCountry } from "../_lib/prefetch-my-country";

/** Every MyCountry section page renders this: the router, with the profile and country already in the query cache. */
export async function MyCountryPage() {
  await prefetchMyCountry();
  return (
    <HydrateClient>
      <MyCountryRouter />
    </HydrateClient>
  );
}
