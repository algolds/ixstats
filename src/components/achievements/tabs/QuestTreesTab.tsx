"use client";

import React, { useState } from "react";
import { TabsContent } from "~/components/ui/tabs";
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
    <TabsContent value="quest-trees" className="space-y-6 outline-none">
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
            className="border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground h-10 px-5 font-semibold"
          >
            {showAllPaths ? "See Less" : `See All Quest Paths (${QUEST_PATHS.length})`}
          </Button>
        </div>
      )}
    </TabsContent>
  );
}
