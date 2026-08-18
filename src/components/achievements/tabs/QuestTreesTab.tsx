"use client";

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { QuestPathCard } from "../QuestPathCard";
import { QUEST_PATHS, getRarityColor, getRarityBg } from "../constants";

interface QuestTreesTabProps {
  achievements: any[] | undefined;
}

export function QuestTreesTab({ achievements }: QuestTreesTabProps) {
  const [showAllPaths, setShowAllPaths] = useState<boolean>(false);
  const pathsToRender = showAllPaths ? QUEST_PATHS : QUEST_PATHS.slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        {pathsToRender.map((path) => (
          <QuestPathCard
            key={path.name}
            path={path}
            achievements={achievements}
            getRarityColor={getRarityColor}
            getRarityBg={getRarityBg}
          />
        ))}
      </div>

      {QUEST_PATHS.length > 4 && (
        <div className="mt-6 flex justify-center">
          <Button
            variant="outline"
            onClick={() => setShowAllPaths(!showAllPaths)}
            className="h-10 rounded-full border-white/10 bg-white/5 px-5 font-bold text-slate-200 transition-all hover:bg-white/10 active:scale-95"
          >
            {showAllPaths ? "See Less" : `See All Quest Paths (${QUEST_PATHS.length})`}
          </Button>
        </div>
      )}
    </div>
  );
}
