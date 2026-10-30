import React, { Suspense } from "react";
import { type Metadata } from "next";
import { ThinktankWorkspace } from "~/components/thinktanks/ThinktankWorkspace";
import { orNullLogged } from "~/lib/site-metadata";
import { db } from "~/server/db";
import { loadThinktankGroupTitle, THINKTANKS_TITLE } from "~/server/modules/thinktanks/metadata";

interface ThinktankGroupPageProps {
  params: Promise<{ groupId: string }>;
}

export async function generateMetadata({ params }: ThinktankGroupPageProps): Promise<Metadata> {
  const { groupId } = await params;
  return {
    title:
      (await orNullLogged(loadThinktankGroupTitle(db, groupId), `thinktank ${groupId}`)) ??
      THINKTANKS_TITLE,
    description:
      "Collaborative research, working papers, group thinks, and ThinkShare discussions.",
  };
}

export default async function ThinktankGroupPage({ params }: ThinktankGroupPageProps) {
  const { groupId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <span className="border-tint h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
            <p className="text-footnote text-label-secondary">Loading group...</p>
          </div>
        </div>
      }
    >
      <ThinktankWorkspace initialGroupId={groupId} />
    </Suspense>
  );
}
