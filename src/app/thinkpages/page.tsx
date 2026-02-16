"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { ThinkPagesRouter } from "~/components/thinkpages/ThinkPagesRouter";

export default function ThinkPagesMainPage() {
  usePageTitle({ title: "ThinkPages" });

  return <ThinkPagesRouter />;
}
