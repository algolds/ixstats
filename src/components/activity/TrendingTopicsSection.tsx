"use client";

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { TrendingUp } from "lucide-react";
import { cn } from "~/lib/utils";
import type { TrendingTopic } from "~/lib/activity-formatting";

interface TrendingTopicsSectionProps {
  show: boolean;
  topics: TrendingTopic[];
}

/** Collapsible "Trending Topics" panel for the activity feed. */
export const TrendingTopicsSection = React.memo(function TrendingTopicsSection({
  show,
  topics,
}: TrendingTopicsSectionProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div className="glass-hierarchy-child rounded-xl p-4">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Trending Topics
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {topics.map((topic) => (
                <div
                  key={topic.id}
                  className="glass-hierarchy-interactive flex cursor-pointer items-center justify-between rounded-lg p-3 transition-transform hover:scale-[1.01]"
                >
                  <div className="min-w-0 flex-1">
                    <h4 className="text-foreground truncate text-sm font-medium">{topic.title}</h4>
                    <p className="text-muted-foreground text-xs">
                      {topic.category} • {topic.participants} participants
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp
                      className={cn(
                        "h-4 w-4",
                        topic.trend === "up"
                          ? "text-green-500"
                          : topic.trend === "down"
                            ? "text-red-500"
                            : "text-gray-500"
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
