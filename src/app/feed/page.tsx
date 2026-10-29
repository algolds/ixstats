"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { ActivityFeedContainer } from "./_components/ActivityFeedContainer";

export default function FeedPage() {
  usePageTitle({ title: "Activity feed" });

  return <ActivityFeedContainer />;
}
