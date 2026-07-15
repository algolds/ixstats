"use client";

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
    return <div className="text-xs text-zinc-500 py-4">Loading version logs...</div>;
  }

  if (!revisions || revisions.length === 0) {
    return <div className="text-xs text-zinc-600 italic py-4">No revisions registered.</div>;
  }

  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
        Revision History ({revisions.length})
      </h4>

      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
        {revisions.map((rev) => {
          const comp = rev.compositionData as unknown as HeraldryComposition;

          return (
            <div
              key={rev.id}
              className="flex items-center gap-4 bg-zinc-950/30 border border-white/5 rounded-lg p-2.5 text-xs justify-between"
            >
              <div className="flex items-center gap-3">
                {/* Micro preview */}
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <ShieldRenderer composition={comp} />
                </div>

                <div className="space-y-0.5">
                  <span className="font-semibold text-zinc-300 block">
                    Version: {rev.version}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">
                    {new Date(rev.createdAt).toLocaleString()}
                  </span>
                  {rev.changeSummary && (
                    <p className="text-[10px] text-zinc-400 italic">
                      Change: {rev.changeSummary}
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRevert(comp)}
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 hover:text-amber-400 transition-all font-semibold text-[10px]"
              >
                Restore
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
