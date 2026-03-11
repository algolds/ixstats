"use client";

import { MyCountryRouter } from "~/components/mycountry/MyCountryRouter";

export const dynamic = "force-dynamic";

export default function MapEditorPage() {
  return <MyCountryRouter />;
}
