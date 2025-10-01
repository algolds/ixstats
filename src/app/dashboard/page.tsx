export const dynamic = 'force-dynamic';

import { HydrateClient } from "~/trpc/server";
import { DashboardCommandCenter } from "./_components/DashboardCommandCenter";

export default function DashboardPage() {
  // MyCountry Activity Center - Main hub for user engagement
  // Full-width experience with MyCountry and Activity tabs only
  return (
    <HydrateClient>
      <DashboardCommandCenter />
    </HydrateClient>
  );
}