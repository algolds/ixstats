"use client";

import React, { useState } from "react";
import Link from "next/link";
import { NavArrowLeft, OpenBook, WhiteFlag, WarningCircle } from "iconoir-react";
import { cn } from "~/lib/utils";
import { assetUrl } from "~/lib/base-path";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetCard } from "~/components/ui/facet-container";
import { soundEffects } from "~/lib/sound/cuelume";
import type { BuilderSection } from "../../lib/builder-theme";
import type { BuilderAlertResult } from "../../lib/builder-alerts";
import type { EditorSection } from "../../lib/edit-changes";
import { BuilderModeToggle } from "../BuilderModeToggle";
import { useBuilderGuide } from "../builder-guide-context";
import { EDITOR_NAV, describeSaveStatus, type EditorSaveStatus } from "./editor-sections";

interface EditorHeaderProps {
  countryName: string;
  flagUrl?: string | null;
  activeSection: BuilderSection;
  onNavigate: (section: BuilderSection) => void;
  changeCounts: Record<EditorSection, number>;
  alertResult?: BuilderAlertResult;
  saveStatus: EditorSaveStatus;
  lastSyncedAt: Date | null;
}

function CountryFlag({ url, name }: { url?: string | null; name: string }) {
  const src = assetUrl(url);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = src && failedSrc !== src;
  return (
    <div className="border-border bg-muted flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border sm:h-12 sm:w-[72px]">
      {showImage ? (
        <img
          src={src}
          alt={`Flag of ${name}`}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <WhiteFlag aria-hidden="true" className="text-muted-foreground h-5 w-5" />
      )}
    </div>
  );
}

/**
 * The country editor's header: a way back to MyCountry, the country being
 * edited, and navigation that jumps straight to any section, each showing how
 * many of its fields changed and whether it has problems to fix.
 */
export const EditorHeader = React.memo(function EditorHeader({
  countryName,
  flagUrl,
  activeSection,
  onNavigate,
  changeCounts,
  alertResult,
  saveStatus,
  lastSyncedAt,
}: EditorHeaderProps) {
  const { openGuide } = useBuilderGuide();
  const displayName = countryName.trim() || "Your country";

  return (
    <header className="mx-auto w-full max-w-6xl px-4 pb-4">
      <FacetCard depth={2} className="flex flex-col gap-4 rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1 text-sm">
            <Link href="/mycountry">
              <NavArrowLeft aria-hidden="true" className="h-4 w-4" />
              MyCountry
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <BuilderModeToggle />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                soundEffects.press();
                openGuide({ tab: "milestones", section: activeSection });
              }}
            >
              <OpenBook aria-hidden="true" className="h-4 w-4" />
              <span className="hidden sm:inline">Guide</span>
              <span className="sr-only sm:hidden">Open the guide</span>
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-4">
          <CountryFlag url={flagUrl} name={displayName} />
          <div className="min-w-0">
            <Eyebrow className="block">Country Editor</Eyebrow>
            <h1 className="text-foreground truncate text-xl font-semibold tracking-tight sm:text-2xl">
              {displayName}
            </h1>
            <p
              className={cn(
                "text-sm",
                saveStatus === "error" ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {describeSaveStatus(saveStatus, lastSyncedAt)}
            </p>
          </div>
        </div>

        <nav aria-label="Editor sections">
          <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {EDITOR_NAV.map((item) => {
              const isActive = item.section === activeSection;
              const changes = item.changeSection ? changeCounts[item.changeSection] : 0;
              const counts = alertResult?.sectionCounts[item.section];
              const errors = counts?.error ?? 0;
              const Icon = item.icon;
              const status = [
                changes > 0 ? `${changes} ${changes === 1 ? "change" : "changes"}` : null,
                errors > 0 ? `${errors} ${errors === 1 ? "issue" : "issues"} to fix` : null,
              ]
                .filter(Boolean)
                .join(", ");

              return (
                <li key={item.section}>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.section)}
                    aria-current={isActive ? "page" : undefined}
                    data-cuelume-press="tick"
                    data-cuelume-hover="tick"
                    className={cn(
                      // Interactive row (depth 3) nested in the header card: a solid surface, no stacked blur.
                      "flex h-full min-h-11 w-full items-start gap-3 rounded-xl border p-3 text-left transition-[background-color,border-color,transform] duration-150 active:scale-[0.98]",
                      "focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                      isActive
                        ? "border-amber-500/50 bg-amber-500/10"
                        : "border-border bg-card hover:bg-accent"
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 h-5 w-5 shrink-0",
                        isActive ? "text-amber-500" : "text-muted-foreground"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground flex items-center gap-2 text-sm font-semibold">
                        {item.label}
                        {status && <span className="sr-only">({status})</span>}
                      </span>
                      <span className="text-muted-foreground hidden text-xs sm:block">
                        {item.description}
                      </span>
                    </span>
                    <span aria-hidden="true" className="flex shrink-0 items-center gap-1">
                      {errors > 0 && <WarningCircle className="text-destructive h-4 w-4" />}
                      {changes > 0 && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 bg-amber-500/10 tabular-nums"
                        >
                          {changes}
                        </Badge>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </FacetCard>
    </header>
  );
});
