import type { Variants } from "motion/react";
import { springGentle } from "~/lib/design/motion";

/**
 * A list whose items rise in once, 40ms apart, on first load (`initial="hidden" animate="show"` on the list,
 * `RISE_ITEM` on each item). Under Reduce Motion `FacetMotionConfig` drops the rise and keeps the fade.
 */
export const RISE_LIST: Variants = { show: { transition: { staggerChildren: 0.04 } } };
export const RISE_ITEM: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: springGentle },
};
