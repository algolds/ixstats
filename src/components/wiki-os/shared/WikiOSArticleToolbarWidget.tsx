"use client";
// src/components/wiki-os/shared/WikiOSArticleToolbarWidget.tsx
// Page tools card with quick access to editing, talk pages, history, stashing, and media theme switching (Auto, Plinth, Raw).

import Link from "next/link";
import {
  EditPencil as FileEdit,
  DesignPencil as Highlighter,
  Clock,
  Link as Link2,
  HalfMoon as SunMoon,
  Square,
  Eye,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { useSidebar } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { StashButton } from "~/components/wiki-os/reader/StashButton";
import { useWikiMediaTheme } from "~/components/wiki-os/shared/MediaThemeContext";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { MEDIA_THEME_OPTIONS } from "~/lib/wiki-os/transformers/media-theme";
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
  setActiveModal: (modal: "history" | "backlinks" | "margin" | null) => void;
}

export function WikiOSArticleToolbarWidget({
  title,
  slug,
  isSignedIn,
  setActiveModal,
}: WikiOSArticleToolbarWidgetProps) {
  const { isCollapsed } = useSidebar();
  const { isMarginOpen, toggleMargin } = useWikiContext();
  const { mediaThemeMode, setMediaThemeMode, cycleMediaThemeMode } = useWikiMediaTheme();

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "auto":
        return <SunMoon className="h-3 w-3 text-sky-400" />;
      case "plinth":
        return <Square className="h-3 w-3 text-emerald-400" />;
      case "raw":
        return <Eye className="h-3 w-3 text-zinc-400" />;
      default:
        return <SunMoon className="h-3 w-3 text-sky-400" />;
    }
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        {/* Edit */}
        {isSignedIn && (
          <Link
            href={withBasePath(`/wiki/${slug}/edit`)}
            className="rail-glow-blue rail-animate-bounce flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/5 text-blue-400 shadow-md transition-all hover:scale-105 hover:bg-blue-500/15 active:scale-95"
            title="Edit Article"
          >
            <FileEdit className="h-4.5 w-4.5" />
          </Link>
        )}

        {/* Margin */}
        <button
          type="button"
          onClick={() => toggleMargin()}
          className={cn(
            "rail-glow-highlighter rail-animate-wiggle flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border shadow-md transition-all hover:scale-105 active:scale-95",
            isMarginOpen
              ? "border-margin-accent bg-margin-accent/25 text-margin-accent ring-margin-accent/40 shadow-margin-accent/20 ring-2"
              : "border-margin-accent/20 bg-margin-accent/10 text-margin-accent hover:bg-margin-accent/20"
          )}
          title={isMarginOpen ? "Hide Margin (T)" : "Show Margin (Threads, Markup) [T]"}
        >
          <Highlighter className="h-4.5 w-4.5" />
        </button>

        {/* Media Theme Quick Cycle */}
        <button
          type="button"
          onClick={cycleMediaThemeMode}
          className="rail-glow-teal flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-teal-500/20 bg-teal-500/5 text-teal-400 shadow-md transition-all hover:scale-105 hover:bg-teal-500/15 active:scale-95"
          title={`Media Theme: ${mediaThemeMode} (Click to cycle Auto / Plinth / Raw)`}
        >
          {getModeIcon(mediaThemeMode)}
        </button>

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
            href={withBasePath(`/wiki/${slug}/edit`)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all hover:bg-white/5"
          >
            <FileEdit className="h-3.5 w-3.5 shrink-0 text-blue-400" />
            <span>Edit Article</span>
          </Link>
        )}

        {/* Margin */}
        <button
          type="button"
          onClick={() => toggleMargin()}
          className={cn(
            "flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition-all",
            isMarginOpen
              ? "bg-margin-accent/20 text-margin-accent font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          <div className="flex items-center gap-2">
            <Highlighter className="text-margin-accent h-3.5 w-3.5 shrink-0" />
            <span>{isMarginOpen ? "Hide Margin" : "Show Margin"}</span>
          </div>
          <kbd className="py-0.2 rounded border border-white/10 bg-white/5 px-1 font-mono text-[9px] text-slate-400">
            T
          </kbd>
        </button>

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

        {/* Media Theme Mode Segmented Selector: Auto | Plinth */}
        <div className="mt-2 space-y-1.5 border-t border-white/5 pt-2">
          <div className="flex items-center justify-between px-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            <span>Media Theme</span>
            <span className="text-[9px] font-semibold text-sky-400 capitalize">
              {mediaThemeMode}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-white/5 bg-black/20 p-0.5 dark:bg-black/30">
            {MEDIA_THEME_OPTIONS.map((opt) => {
              const isSelected = mediaThemeMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMediaThemeMode(opt.value)}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-md px-1 py-1 text-[9.5px] font-semibold transition-all ${
                    isSelected
                      ? "border border-blue-500/30 bg-blue-500/20 text-blue-300 shadow-sm"
                      : "border border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                  title={`${opt.label}: ${opt.description}`}
                >
                  {getModeIcon(opt.value)}
                  <span className="mt-0.5 scale-90">{opt.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Stash Button */}
        <div className="mt-2 border-t border-white/5 px-1 pt-2">
          <StashButton title={title} isAuthenticated={isSignedIn} />
        </div>
      </CutoutCardContent>
    </CutoutCard>
  );
}
