"use client";

/**
 * /mycountry/v2 — gated preview of the v2 command surface (design-bible v2).
 * Renders the shared MyCountryV2 shell locked to the signed-in user's own country
 * (no picker), behind the auth guard. See plans/mycountry-v2-migration.md.
 */

import { MyCountryRouter } from "~/components/mycountry";

export default function MyCountryV2Route() {
  return <MyCountryRouter v2={true} />;
}
