import type { Metadata } from "next";
import { getSignedInCountryId } from "~/lib/auth/signed-in-country.server";
import { DashboardPageClient } from "../DashboardPageClient";

export const metadata: Metadata = { title: "Accounts - IxStats" };

export default async function DashboardAccountsPage() {
  // Resolved on the server so the hub's country query runs alongside users.getProfile, not after it.
  const initialCountryId = await getSignedInCountryId();

  return <DashboardPageClient initialCountryId={initialCountryId} initialSection="accounts" />;
}
