"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { ActivityFeedContainer } from "./_components/ActivityFeedContainer";
import { InteractiveGridPattern } from "~/components/ui/magicui/interactive-grid-pattern";

export default function FeedPage() {
  usePageTitle({ title: "Activity Feed" });

  return (
    <div className="bg-background relative min-h-screen">
      {/* Standard IxStats Interactive Grid Background */}
      <InteractiveGridPattern
        width={40}
        height={40}
        squares={[50, 40]}
        className="fixed inset-0 z-0 opacity-20"
        squaresClassName="fill-label-tertiary stroke-separator transition-[fill] duration-200 [&:nth-child(odd):hover]:fill-tint/40"
      />
      <ActivityFeedContainer />
    </div>
  );
}
