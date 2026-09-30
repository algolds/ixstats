import { ThinkPagesAccountHub } from "~/components/thinkpages/ThinkPagesAccountHub";
import { getSignedInCountryId } from "~/lib/auth/signed-in-country.server";

export default async function ThinkPagesMainPage() {
  // Server-resolved so the hub's country query runs alongside users.getProfile, not after it.
  const initialCountryId = await getSignedInCountryId();

  return <ThinkPagesAccountHub initialCountryId={initialCountryId} />;
}
