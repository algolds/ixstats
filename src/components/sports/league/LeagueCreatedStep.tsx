"use client";

import { motion } from "motion/react";
import { Undo as RotateCcw } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { springSmooth } from "~/lib/design/motion";
import { stepVariants } from "./league-creator-config";

interface LeagueCreatedStepProps {
  icon: string | undefined;
  leagueName: string;
  onView: () => void;
  onCreateAnother: () => void;
}

/** Step 4 of the league creator: the confirmation after the league is chartered. */
export function LeagueCreatedStep({
  icon,
  leagueName,
  onView,
  onCreateAnother,
}: LeagueCreatedStepProps) {
  return (
    <motion.div
      key="step-4"
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={springSmooth}
      className="space-y-6"
    >
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="bg-tint-fill mb-4 flex h-16 w-16 items-center justify-center rounded-full"
        >
          <span className="text-large-title">{icon}</span>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-label text-title-3 font-semibold">League created</h3>
          <p className="text-label-secondary text-body mt-1">
            {leagueName} is now active and ready for configuration.
          </p>
        </motion.div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button onClick={onView}>View league</Button>
        <Button variant="outline" onClick={onCreateAnother}>
          <RotateCcw className="h-4 w-4" />
          Create another
        </Button>
      </div>
    </motion.div>
  );
}
