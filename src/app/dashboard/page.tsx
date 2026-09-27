import { getSignedInCountryId } from "~/lib/auth/signed-in-country.server";
import { DashboardPageClient } from "./DashboardPageClient";

export default async function DashboardPage() {
  // Resolved on the server so the dashboard's country-scoped queries start on the first client
  // render instead of waiting for users.getProfile to return the country id.
  const initialCountryId = await getSignedInCountryId();

  return <DashboardPageClient initialCountryId={initialCountryId} />;
}
