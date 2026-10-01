"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import ShieldRenderer from "./renderer/ShieldRenderer";
import type { HeraldryComposition } from "~/lib/heraldry";

interface RevisionHistoryProps {
  achievementId: string;
}

export default function RevisionHistory({ achievementId }: RevisionHistoryProps) {
  const router = useRouter();

  const { data: revisions, isLoading } = api.heraldry.getRevisionHistory.useQuery({
    achievementId,
  });

  const handleRevert = (comp: any) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("vexel-draft", JSON.stringify(comp));
      router.push(`/labs/vexel/${achievementId}`);
      // Force reload to pick up sessionStorage changes if already on edit page
      setTimeout(() => window.location.reload(), 100);
    }
  };

  if (isLoading) {
    return <div className="text-label-secondary text-footnote py-4">Loading version logs...</div>;
  }

  if (!revisions || revisions.length === 0) {
    return (
      <div className="text-label-secondary text-footnote py-4 italic">No revisions registered.</div>
    );
  }

  return (
    <div className="space-y-4">
      <Eyebrow className="block">Revision History ({revisions.length})</Eyebrow>

      <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
        {revisions.map((rev, idx) => {
          const comp = rev.compositionData as unknown as HeraldryComposition;

          return (
            <div
              key={rev.id}
              className="border-separator bg-surface rounded-control text-footnote flex items-center justify-between gap-4 border p-2"
            >
              <div className="flex items-center gap-3">
                {/* Micro preview */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <ShieldRenderer composition={comp} />
                </div>

                <div className="space-y-0.5">
                  <span className="text-label-secondary block font-semibold">
                    Version: {revisions.length - idx}
                  </span>
                  <span className="text-label-secondary text-footnote block">
                    {new Date(rev.createdAt).toLocaleString()}
                  </span>
                  {rev.revisionNote && (
                    <p className="text-label-secondary text-footnote italic">
                      Change: {rev.revisionNote}
                    </p>
                  )}
                </div>
              </div>

              <Button variant="outline" size="xs" onClick={() => handleRevert(comp)}>
                Restore
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
