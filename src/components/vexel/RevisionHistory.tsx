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
    return <div className="py-4 text-xs text-zinc-500">Loading version logs...</div>;
  }

  if (!revisions || revisions.length === 0) {
    return <div className="py-4 text-xs text-zinc-600 italic">No revisions registered.</div>;
  }

  return (
    <div className="space-y-4">
      <h4 className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
        Revision History ({revisions.length})
      </h4>

      <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
        {revisions.map((rev) => {
          const comp = rev.compositionData as unknown as HeraldryComposition;

          return (
            <div
              key={rev.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-white/5 bg-zinc-950/30 p-2.5 text-xs"
            >
              <div className="flex items-center gap-3">
                {/* Micro preview */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <ShieldRenderer composition={comp} />
                </div>

                <div className="space-y-0.5">
                  <span className="block font-semibold text-zinc-300">Version: {rev.version}</span>
                  <span className="block text-[10px] text-zinc-500">
                    {new Date(rev.createdAt).toLocaleString()}
                  </span>
                  {rev.changeSummary && (
                    <p className="text-[10px] text-zinc-400 italic">Change: {rev.changeSummary}</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => handleRevert(comp)}
                className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold transition-all hover:bg-zinc-700 hover:text-amber-400"
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
