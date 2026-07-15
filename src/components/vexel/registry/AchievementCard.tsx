"use client";

import React from "react";
import Link from "next/link";
import ShieldRenderer from "../renderer/ShieldRenderer";
import type { HeraldryComposition } from "~/lib/heraldry";
import { FacetMaterial } from "~/components/facet-ui";

interface AchievementCardProps {
  achievement: {
    id: string;
    title: string;
    subjectType: string;
    subjectId: string | null;
    compositionData: any;
    generatedBlazon: string;
    isPublished: boolean;
    ownerId: string;
  };
}

export default function AchievementCard({ achievement }: AchievementCardProps) {
  const composition = achievement.compositionData as unknown as HeraldryComposition;

  const getSubjectBadgeColor = (type: string) => {
    switch (type) {
      case "COUNTRY":
        return "bg-cyan-500/10 text-cyan-400 border-cyan-500/20";
      case "DYNASTY":
        return "bg-purple-500/10 text-purple-400 border-purple-500/20";
      case "INSTITUTION":
        return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  return (
    <FacetMaterial
      material="satin"
      className="group block overflow-hidden rounded-xl border border-white/10 shadow-md transition-all duration-200 outline-none hover:border-amber-500/25"
    >
      <Link href={`/labs/vexel/registry/${achievement.id}`} className="block">
        <div className="flex flex-col items-center gap-4 p-4">
          {/* Thumbnail */}
          <div className="relative flex h-32 w-32 transform items-center justify-center transition-transform duration-200 group-hover:scale-[1.03]">
            <ShieldRenderer composition={composition} />
          </div>

          {/* Info */}
          <div className="flex w-full flex-1 flex-col justify-between space-y-1.5 text-center">
            <div>
              <span
                className={`mb-1 inline-block rounded-full border px-2 py-0.5 text-[8px] font-bold tracking-widest uppercase ${getSubjectBadgeColor(
                  achievement.subjectType
                )}`}
              >
                {achievement.subjectType}
              </span>

              <h4 className="truncate text-xs font-bold text-zinc-200 transition-colors group-hover:text-amber-400">
                {achievement.title}
              </h4>

              <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                By: {achievement.ownerId.slice(0, 8)}
              </p>
            </div>

            <p className="mt-2 line-clamp-2 border-t border-white/5 px-1 pt-2 font-serif text-[10px] text-zinc-400 italic">
              {achievement.generatedBlazon}
            </p>
          </div>
        </div>
      </Link>
    </FacetMaterial>
  );
}
