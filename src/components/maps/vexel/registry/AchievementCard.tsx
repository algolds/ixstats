"use client";

import React from "react";
import Link from "next/link";
import ShieldRenderer from "../renderer/ShieldRenderer";
import type { HeraldryComposition } from "~/lib/heraldry";
import { FacetMaterial } from "~/components/ui/facet";

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
        return "bg-muted text-foreground border-border";
      case "DYNASTY":
        return "bg-muted text-foreground border-border";
      case "INSTITUTION":
        return "bg-muted text-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <FacetMaterial
      material="satin"
      className="group border-border block overflow-hidden rounded-xl border shadow-md transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 outline-none hover:border-amber-500/25"
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
                className={`mb-1 inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${getSubjectBadgeColor(
                  achievement.subjectType
                )}`}
              >
                {achievement.subjectType.toLowerCase()}
              </span>

              <h4 className="text-foreground truncate text-xs font-bold transition-colors group-hover:text-amber-500">
                {achievement.title}
              </h4>

              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                By: {achievement.ownerId.slice(0, 8)}
              </p>
            </div>

            <p className="border-border text-muted-foreground mt-2 line-clamp-2 border-t px-1 pt-2 font-serif text-xs italic">
              {achievement.generatedBlazon}
            </p>
          </div>
        </div>
      </Link>
    </FacetMaterial>
  );
}
