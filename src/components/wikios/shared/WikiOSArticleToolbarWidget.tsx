// src/components/wikios/shared/WikiOSArticleToolbarWidget.tsx
// Page tools card with quick access to editing, talk pages, history, and stashing.

"use client";

import Link from "next/link";
import { FileEdit, MessageSquare, Clock, Link2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { useSidebar } from "~/components/dashboard/DashboardSidebarLayout";
import { StashButton } from "~/components/wikios/reader/StashButton";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";

interface WikiOSArticleToolbarWidgetProps {
  title: string;
  slug: string;
  isSignedIn: boolean;
  setActiveModal: (modal: "history" | "backlinks" | null) => void;
}

export function WikiOSArticleToolbarWidget({
  title,
  slug,
  isSignedIn,
  setActiveModal,
}: WikiOSArticleToolbarWidgetProps) {
  const { isCollapsed } = useSidebar();

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        {/* Edit */}
        {isSignedIn && (
          <Link
            href={withBasePath(`/w/${slug}/edit`)}
            className="rail-glow-blue rail-animate-bounce flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/5 text-blue-400 shadow-md transition-all hover:scale-105 hover:bg-blue-500/15 active:scale-95"
            title="Edit Article"
          >
            <FileEdit className="h-4.5 w-4.5" />
          </Link>
        )}

        {/* Talk */}
        <Link
          href={withBasePath(`/w/${slug}/talk`)}
          className="rail-glow-purple rail-animate-wiggle flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/5 text-purple-400 shadow-md transition-all hover:scale-105 hover:bg-purple-500/15 active:scale-95"
          title="Discussion (Talk)"
        >
          <MessageSquare className="h-4.5 w-4.5" />
        </Link>

        {/* Stash */}
        <StashButton title={title} isAuthenticated={isSignedIn} isCollapsed={true} />
      </div>
    );
  }

  return (
    <CutoutCard
      className={cn(
        cutoutCardSurfaceClassName,
        "w-48 overflow-hidden rounded-xl border-blue-500/20 bg-gradient-to-b from-blue-500/5 to-transparent"
      )}
      trackPointerHover={false}
      texture="dots"
      textureOpacity={0.06}
    >
      <div className="relative bg-blue-500/10 px-3 pt-2.5 pb-4">
        <div className="text-card-foreground flex items-center gap-1.5 text-xs font-bold text-blue-400">
          <FileEdit className="h-3.5 w-3.5" />
          Page Tools
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={16} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={16} />
      </div>

      <CutoutCardContent className="space-y-1 p-3 pt-1">
        {/* Edit */}
        {isSignedIn && (
          <Link
            href={withBasePath(`/w/${slug}/edit`)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all hover:bg-white/5"
          >
            <FileEdit className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <span>Edit Article</span>
          </Link>
        )}

        {/* Talk */}
        <Link
          href={withBasePath(`/w/${slug}/talk`)}
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all hover:bg-white/5"
        >
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-purple-400" />
          <span>Discussion (Talk)</span>
        </Link>

        {/* History */}
        <button
          onClick={() => setActiveModal("history")}
          className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition-all hover:bg-white/5"
          type="button"
        >
          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          <span>Revision History</span>
        </button>

        {/* Backlinks */}
        <button
          onClick={() => setActiveModal("backlinks")}
          className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition-all hover:bg-white/5"
          type="button"
        >
          <Link2 className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
          <span>What Links Here</span>
        </button>

        {/* Stash Button */}
        <div className="mt-1 border-t border-white/5 px-1 pt-2">
          <StashButton title={title} isAuthenticated={isSignedIn} />
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}
