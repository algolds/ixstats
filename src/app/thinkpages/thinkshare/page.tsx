"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { ThinkPagesRouter } from "~/components/thinkpages/ThinkPagesRouter";

export default function ThinkSharePage() {
  usePageTitle({ title: "ThinkShare - ThinkPages" });

  return <ThinkPagesRouter />;
}
