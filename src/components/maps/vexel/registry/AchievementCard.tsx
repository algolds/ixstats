"use client";

import React from "react";
import Link from "next/link";
import ShieldRenderer from "../renderer/ShieldRenderer";
import type { HeraldryComposition } from "~/lib/heraldry";
import { Card } from "~/components/ui/card";

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
        return "bg-fill-3 text-label border-separator";
      case "DYNASTY":
        return "bg-fill-3 text-label border-separator";
      case "INSTITUTION":
        return "bg-fill-3 text-label border-separator";
      default:
        return "bg-fill-3 text-label-secondary border-separator";
    }
  };

  return (
    <Card className="group block overflow-hidden">
      <Link href={`/labs/vexel/registry/${achievement.id}`} className="block">
        <div className="flex flex-col items-center gap-4 p-4">
          {/* Thumbnail */}
          <div className="relative flex h-32 w-32 transform items-center justify-center transition-transform duration-200 group-hover:scale-[1.03]">
            <ShieldRenderer composition={composition} />
          </div>

          {/* Info */}
          <div className="flex w-full flex-1 flex-col justify-between space-y-2 text-center">
            <div>
              <span
                className={`text-caption mb-1 inline-block rounded-full border px-2 py-0.5 capitalize ${getSubjectBadgeColor(
                  achievement.subjectType
                )}`}
              >
                {achievement.subjectType.toLowerCase()}
              </span>

              <h4 className="text-label text-caption group-hover:text-tint truncate font-semibold transition-colors">
                {achievement.title}
              </h4>

              <p className="text-label-secondary text-footnote mt-0.5 truncate">
                By: {achievement.ownerId.slice(0, 8)}
              </p>
            </div>

            <p className="border-separator text-label-secondary text-footnote mt-2 line-clamp-2 border-t px-1 pt-2 italic">
              {achievement.generatedBlazon}
            </p>
          </div>
        </div>
      </Link>
    </Card>
  );
}
