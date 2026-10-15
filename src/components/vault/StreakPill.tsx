"use client";

import { motion } from "motion/react";
import { FireFlame as Flame } from "iconoir-react";
import { springGentle } from "~/lib/design/motion";
import { STREAK_BOOST_FULL_DAYS } from "~/lib/vault/daily-roll";

/**
 * The login streak as a warm pill. Its fill is the way to the boost's peak (day `STREAK_BOOST_FULL_DAYS`), swept in
 * as it appears, and the flame flickers now and then; both hold still under Reduce Motion (FacetMotionConfig).
 */
export function StreakPill({ streak }: { streak: number }) {
  const progress = Math.min(streak / STREAK_BOOST_FULL_DAYS, 1);
  return (
    <span
      data-slot="streak-pill"
      data-peak={progress === 1 || undefined}
      title={
        progress === 1
          ? "Streak boost at its peak"
          : `The boost peaks on day ${STREAK_BOOST_FULL_DAYS}`
      }
      className="bg-orange/10 text-orange-ink text-caption relative isolate inline-flex shrink-0 items-center gap-1 overflow-hidden rounded-full px-2 py-0.5 font-semibold tabular-nums"
    >
      <motion.span
        aria-hidden
        className="bg-orange/20 absolute inset-0 -z-10 origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: progress }}
        transition={springGentle}
      />
      <motion.span
        aria-hidden
        className="inline-flex origin-bottom"
        animate={{ rotate: [0, -8, 5, -2, 0], scaleY: [1, 1.12, 0.94, 1.04, 1] }}
        transition={{ duration: 0.9, ease: "easeInOut", repeat: Infinity, repeatDelay: 3.2 }}
      >
        <Flame className="size-3" />
      </motion.span>
      <span aria-hidden>{streak}d</span>
      <span className="sr-only">{streak} day streak</span>
    </span>
  );
}
