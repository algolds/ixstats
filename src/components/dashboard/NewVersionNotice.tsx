"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { X, ArrowRight } from "lucide-react";
import { MdBrowserUpdated } from "react-icons/md";
import { APP_VERSION, BUILD_VERSION, CHANNEL } from "~/lib/buildVersion";
import { TextureOverlay } from "~/components/ui/texture-overlay";

const STORAGE_KEY = "ixstats:version-seen";

export function NewVersionNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const current = `${APP_VERSION}+${BUILD_VERSION}`;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== current) {
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
      className="glass-surface flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"
    >
      <TextureOverlay texture="chevron" opacity={0.06} />
      <div className="relative z-10 flex items-center gap-2.5">
        <MdBrowserUpdated className="h-4 w-4 shrink-0 text-blue-400" />
        <p className="text-foreground text-xs font-medium">
          New version! The system has been updated to{" "}
          <Link href="/changelog" className="font-semibold text-blue-400 hover:underline">
            v{APP_VERSION}
          </Link>{" "}
          <span className="text-muted-foreground font-mono text-[10px]">({BUILD_VERSION})</span>.
        </p>
      </div>
      <div className="relative z-10 flex items-center gap-2">
        <Link
          href="/changelog"
          className="group inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-semibold text-blue-400 transition-all hover:bg-blue-500/20 active:scale-[0.97]"
        >
          <span>What's New</span>
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground rounded-lg p-1 transition-colors hover:bg-white/5"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
