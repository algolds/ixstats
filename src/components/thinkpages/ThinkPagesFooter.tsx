"use client";

import { motion } from "motion/react";
import { ThinkPagesIcon } from "./ThinkPagesIcon";

export function ThinkPagesFooter() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="mt-16 border-t pt-8 text-center"
    >
      <div className="mb-4 flex items-center justify-center gap-2">
        <ThinkPagesIcon size={22} />
        <span className="text-foreground font-semibold tracking-tight">
          ThinkPages
        </span>
      </div>

      <div className="text-muted-foreground space-y-2 text-xs">
        <p>
          &copy; 2002-2040{" "}
          <a href="https://ixwiki.com/wiki/Valtari">Valtari Technologies, Inc.</a>
        </p>
        <p>Made with ♡ from Hollona and Diorisia</p>
        <p>
          Where nations converge, ideas flourish, and the future of global discourse takes
          shape.
        </p>
      </div>
    </motion.div>
  );
}
