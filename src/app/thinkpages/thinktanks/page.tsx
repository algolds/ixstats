"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { ThinkPagesRouter } from "~/components/thinkpages/ThinkPagesRouter";

export default function ThinkTanksPage() {
  usePageTitle({ title: "ThinkTanks - ThinkPages" });

  return <ThinkPagesRouter />;
}
