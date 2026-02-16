"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { ThinkPagesRouter } from "~/components/thinkpages/ThinkPagesRouter";

export default function ThinkPagesFeedPage() {
  usePageTitle({ title: "Feed - ThinkPages" });

  return <ThinkPagesRouter />;
}
