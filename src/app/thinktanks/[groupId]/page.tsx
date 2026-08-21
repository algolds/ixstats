import React, { Suspense } from "react";
import { type Metadata } from "next";
import { ThinktankWorkspace } from "~/components/thinktanks/ThinktankWorkspace";

interface ThinktankGroupPageProps {
  params: Promise<{ groupId: string }>;
}

export async function generateMetadata({ params }: ThinktankGroupPageProps): Promise<Metadata> {
  const { groupId } = await params;
  return {
    title: `ThinkTank Workspace — ${groupId} | IxStates`,
    description: "Collaborative research, working papers, group thinks, and ThinkShare discussions.",
  };
}

export default async function ThinktankGroupPage({ params }: ThinktankGroupPageProps) {
  const { groupId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
            <p className="text-xs font-semibold text-muted-foreground">Loading group...</p>
          </div>
        </div>
      }
    >
      <ThinktankWorkspace initialGroupId={groupId} />
    </Suspense>
  );
}
