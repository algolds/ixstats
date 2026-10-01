import { ThinkPagesAccountHub } from "~/components/thinkpages/ThinkPagesAccountHub";
import { getSignedInCountryId } from "~/lib/auth/signed-in-country.server";
import { ShellPageHeader } from "~/components/shell/ShellPageHeader";

export default async function ThinkPagesMainPage() {
  // Server-resolved so the hub's country query runs alongside users.getProfile, not after it.
  const initialCountryId = await getSignedInCountryId();

  return (
    <>
      {/* Phone title under the new navigation shell (nothing with the flag off). */}
      <ShellPageHeader title="ThinkPages" />
      <ThinkPagesAccountHub initialCountryId={initialCountryId} />
    </>
  );
}
