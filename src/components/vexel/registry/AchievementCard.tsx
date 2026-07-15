"use client";

import React from "react";
import Link from "next/link";
import ShieldRenderer from "../renderer/ShieldRenderer";
import type { HeraldryComposition } from "~/lib/heraldry";

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
    <Link
      href={`/labs/vexel/registry/${achievement.id}`}
      className="group rounded-xl border border-white/5 bg-zinc-900/30 p-4 flex flex-col items-center gap-4 transition-all duration-200 hover:border-amber-500/25 hover:bg-zinc-900/50 shadow-md outline-none"
    >
      {/* Thumbnail */}
      <div className="w-32 h-32 flex items-center justify-center transform group-hover:scale-[1.03] transition-transform duration-200 relative">
        <ShieldRenderer composition={composition} />
      </div>

      {/* Info */}
      <div className="w-full space-y-1.5 text-center flex-1 flex flex-col justify-between">
        <div>
          <span
            className={`inline-block text-[8px] font-bold px-2 py-0.5 rounded-full border mb-1 uppercase tracking-widest ${getSubjectBadgeColor(
              achievement.subjectType
            )}`}
          >
            {achievement.subjectType}
          </span>
          
          <h4 className="text-xs font-bold text-zinc-200 truncate group-hover:text-amber-400 transition-colors">
            {achievement.title}
          </h4>

          <p className="text-[10px] text-zinc-500 truncate mt-0.5">
            By: {achievement.ownerId.slice(0, 8)}
          </p>
        </div>

        <p className="text-[10px] font-serif italic text-zinc-400 line-clamp-2 px-1 mt-2 border-t border-white/5 pt-2">
          {achievement.generatedBlazon}
        </p>
      </div>
    </Link>
  );
}
