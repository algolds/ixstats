"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Xmark as X, ArrowRight, Spark } from "iconoir-react";
import { APP_VERSION, BUILD_VERSION } from "~/lib/buildVersion";
import { Button } from "~/components/ui/button";
import { springGentle } from "~/lib/design/motion";

const STORAGE_KEY = "ixstats:version-seen";

export function NewVersionNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const current = `${APP_VERSION}+${BUILD_VERSION}`;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== current) {
      // oxlint-disable-next-line
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, `${APP_VERSION}+${BUILD_VERSION}`);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springGentle}
      role="status"
      className="bg-surface border-separator rounded-row shadow-card flex flex-wrap items-center justify-between gap-3 border p-4"
    >
      <div className="flex items-center gap-2">
        <Spark aria-hidden className="text-tint size-4 shrink-0" />
        <p className="text-label text-body">
          New version: the system has been updated to{" "}
          <Link href="/changelog" className="text-tint font-medium hover:underline">
            v{APP_VERSION}
          </Link>{" "}
          <span className="text-label-secondary text-footnote tabular-nums">({BUILD_VERSION})</span>
          .
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="tinted" size="sm">
          <Link href="/changelog">
            <span>What&apos;s new</span>
            <ArrowRight aria-hidden />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dismiss}
          className="text-label-secondary"
          title="Dismiss"
          aria-label="Dismiss"
        >
          <X />
        </Button>
      </div>
    </motion.div>
  );
}
