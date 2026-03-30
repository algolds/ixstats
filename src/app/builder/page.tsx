"use client";
export const dynamic = "force-dynamic";

import { usePageTitle } from "~/hooks/usePageTitle";
import { BuilderRouter } from "./components/BuilderRouter";

export default function CreateCountryBuilder() {
  usePageTitle({ title: "Nation Builder" });

  return <BuilderRouter />;
}
