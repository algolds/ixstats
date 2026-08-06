"use client";

import { MyCountryRouter } from "~/components/mycountry";

export const dynamic = "force-dynamic";

export default function MyCountryPage() {
  return <MyCountryRouter v2 />;
}
