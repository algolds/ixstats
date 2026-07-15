"use client";

import { MyCountryRouter } from "~/components/mycountry";

/**
 * /labs/mycountry-v2 — Labs route redirected to the new unified MyCountry V2
 * command surface. Replaces old monolithic mockup code.
 */
export default function MyCountryV2LabsRoute() {
  return <MyCountryRouter v2={true} />;
}
