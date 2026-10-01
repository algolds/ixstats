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
import { CutoutCard, CutoutCardHeader } from "~/components/ui/cutout-card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Button } from "~/components/ui/button";

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
        return <SunMoon className="text-teal h-3 w-3" />;
      case "plinth":
        return <Square className="text-green h-3 w-3" />;
      case "raw":
        return <Eye className="text-label-secondary h-3 w-3" />;
      default:
        return <SunMoon className="text-teal h-3 w-3" />;
    }
  };

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        {/* Edit */}
        {isSignedIn && (
          <Link
            href={withBasePath(`/wiki/${slug}/edit`)}
            className="rail-glow-blue rail-animate-bounce rounded-row border-tint/20 bg-tint/5 text-tint shadow-card hover:bg-tint/15 flex h-10 w-10 items-center justify-center border transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-[0.98]"
            title="Edit Article"
          >
            <FileEdit className="size-4.5" />
          </Link>
        )}

        {/* Margin */}
        <Button
          variant="tinted"
          size="icon-lg"
          aria-pressed={isMarginOpen}
          aria-label="Margin"
          onClick={() => toggleMargin()}
          className={cn(
            "rail-glow-highlighter rail-animate-wiggle rounded-row shadow-card size-10 border",
            isMarginOpen
              ? "border-margin-accent bg-margin-accent/25 text-margin-accent ring-margin-accent/40 shadow-margin-accent/20 ring-2"
              : "border-margin-accent/20 bg-margin-accent/10 text-margin-accent hover:bg-margin-accent/20"
          )}
          title={isMarginOpen ? "Hide Margin (T)" : "Show Margin (Threads, Markup) [T]"}
        >
          <Highlighter className="size-4.5" />
        </Button>

        {/* Media Theme Quick Cycle */}
        <Button
          variant="tinted"
          size="icon-lg"
          aria-label={`Media theme: ${mediaThemeMode}`}
          onClick={cycleMediaThemeMode}
          className="rounded-row border-teal/20 bg-teal/5 text-teal hover:bg-teal/15 size-10 border"
          title={`Media Theme: ${mediaThemeMode} (Click to cycle Auto / Plinth / Raw)`}
        >
          {getModeIcon(mediaThemeMode)}
        </Button>

        {/* Stash */}
        <StashButton title={title} isAuthenticated={isSignedIn} isCollapsed={true} />
      </div>
    );
  }

  return (
    // v2 (c5c6b382): a CutoutCard with the tinted cutout tab header.
    <CutoutCard variant="card" trackPointerHover={false} className="w-48 rounded-xl">
      <CutoutCardHeader icon={<FileEdit />} cornerSize={16} className="px-3 pt-2 pb-4">
        Page Tools
      </CutoutCardHeader>

      <div className="space-y-0.5 p-2">
        {/* Edit */}
        {isSignedIn && (
          <Button asChild variant="ghost" className={toolRowClassName}>
            <Link href={withBasePath(`/wiki/${slug}/edit`)}>
              <FileEdit className="text-tint size-3.5 shrink-0" aria-hidden="true" />
              <span>Edit Article</span>
            </Link>
          </Button>
        )}

        {/* Margin */}
        <Button
          variant="ghost"
          aria-pressed={isMarginOpen}
          onClick={() => toggleMargin()}
          className={cn(
            toolRowClassName,
            "justify-between",
            isMarginOpen && "bg-margin-bg hover:bg-margin-bg text-label"
          )}
        >
          <span className="flex items-center gap-2">
            <Highlighter className="text-margin-accent size-3.5 shrink-0" aria-hidden="true" />
            <span>{isMarginOpen ? "Hide Margin" : "Show Margin"}</span>
          </span>
          <kbd className="rounded-control-sm border-separator bg-fill-4 text-caption text-label-secondary border px-1">
            T
          </kbd>
        </Button>

        {/* History */}
        <Button
          variant="ghost"
          onClick={() => setActiveModal("history")}
          className={toolRowClassName}
        >
          <Clock className="text-label-secondary size-3.5 shrink-0" aria-hidden="true" />
          <span>Revision History</span>
        </Button>

        {/* Backlinks */}
        <Button
          variant="ghost"
          onClick={() => setActiveModal("backlinks")}
          className={toolRowClassName}
        >
          <Link2 className="text-label-secondary size-3.5 shrink-0" aria-hidden="true" />
          <span>What Links Here</span>
        </Button>

        {/* Media theme */}
        <div className="border-separator mt-2 space-y-2 border-t px-1 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-subhead text-label-secondary">Media Theme</span>
            <span className="text-caption text-label-secondary capitalize">{mediaThemeMode}</span>
          </div>
          <SegmentedControl
            aria-label="Media theme"
            size="sm"
            fullWidth
            value={mediaThemeMode}
            onValueChange={setMediaThemeMode}
            options={MEDIA_THEME_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.shortLabel,
              icon: getModeIcon(opt.value),
            }))}
          />
        </div>

        {/* Stash */}
        <div className="border-separator mt-2 border-t px-1 pt-2">
          <StashButton title={title} isAuthenticated={isSignedIn} />
        </div>
      </div>
    </CutoutCard>
  );
}

/** A command row in the Page Tools card (a ghost `Button`). */
const toolRowClassName =
  "text-callout text-label h-auto w-full justify-start px-2 py-2 font-normal";
