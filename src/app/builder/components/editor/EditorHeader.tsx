"use client";

import React, { useState } from "react";
import Link from "next/link";
import { NavArrowLeft, OpenBook, WhiteFlag, WarningCircle } from "iconoir-react";
import { cn } from "~/lib/utils";
import { assetUrl } from "~/lib/base-path";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { soundEffects } from "~/lib/sound/cuelume";
import type { BuilderSection } from "../../lib/builder-theme";
import type { BuilderAlertResult } from "../../lib/builder-alerts";
import type { EditorSection } from "../../lib/edit-changes";
import { BuilderModeToggle } from "../BuilderModeToggle";
import { useBuilderGuide } from "../builder-guide-context";
import { EDITOR_NAV, describeSaveStatus, type EditorSaveStatus } from "./editor-sections";
import { FacetMaterial } from "~/components/ui/facet/shared/FacetMaterial";

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
    <div className="border-separator bg-fill-3 flex h-6 w-9 shrink-0 items-center justify-center overflow-hidden rounded-sm border">
      {showImage ? (
        <img
          src={src}
          alt={`Flag of ${name}`}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <WhiteFlag aria-hidden="true" className="text-label-secondary h-4 w-4" />
      )}
    </div>
  );
}

function sectionStatus(changes: number, errors: number): string {
  return [
    changes > 0 ? `${changes} ${changes === 1 ? "change" : "changes"}` : null,
    errors > 0 ? `${errors} ${errors === 1 ? "issue" : "issues"} to fix` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * The country editor's toolbar: a way back to MyCountry, the country being edited with its save status, and
 * tabs that jump straight to any section, each showing how many of its fields changed and whether it has
 * problems to fix. One compact sticky row (two on phones) so the page is left to the editor's controls.
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
    <header className="z-sticky sticky top-(--shell-top-offset) mx-auto w-full max-w-6xl px-4 pb-3">
      <FacetMaterial className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2 md:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-none">
          <Button asChild variant="ghost" size="icon" className="shrink-0">
            <Link href="/mycountry" aria-label="Back to MyCountry">
              <NavArrowLeft aria-hidden="true" className="h-4 w-4" />
            </Link>
          </Button>
          <CountryFlag url={flagUrl} name={displayName} />
          <div className="min-w-0">
            <h1 className="text-label text-headline truncate">{displayName}</h1>
            <p
              className={cn(
                "text-caption truncate",
                saveStatus === "error" ? "text-destructive" : "text-label-secondary"
              )}
            >
              {describeSaveStatus(saveStatus, lastSyncedAt)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:order-last">
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
            <span className="hidden lg:inline">Guide</span>
            <span className="sr-only lg:hidden">Open the guide</span>
          </Button>
        </div>

        <nav
          aria-label="Editor sections"
          className="order-last w-full min-w-0 overflow-x-auto md:order-none md:flex md:w-auto md:flex-1 md:justify-center"
          style={{ scrollbarWidth: "none" }}
        >
          <ul className="flex items-center gap-1">
            {EDITOR_NAV.map((item) => {
              const isActive = item.section === activeSection;
              const changes = item.changeSection ? changeCounts[item.changeSection] : 0;
              const errors = alertResult?.sectionCounts[item.section]?.error ?? 0;
              const status = sectionStatus(changes, errors);
              const Icon = item.icon;

              return (
                <li key={item.section} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => onNavigate(item.section)}
                    aria-current={isActive ? "page" : undefined}
                    title={item.description}
                    data-cuelume-press="tick"
                    data-cuelume-hover="tick"
                    className={cn(
                      "text-subhead flex h-9 items-center gap-2 rounded-full border px-3 whitespace-nowrap transition-colors duration-150",
                      "focus-visible:ring-tint focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                      isActive
                        ? "border-tint/50 bg-tint-fill text-label font-semibold"
                        : "text-label-secondary hover:bg-fill-3 hover:text-label border-transparent"
                    )}
                  >
                    <Icon
                      aria-hidden="true"
                      className={cn("h-4 w-4 shrink-0", isActive && "text-tint")}
                    />
                    {item.label}
                    {status && <span className="sr-only">({status})</span>}
                    {errors > 0 && (
                      <WarningCircle aria-hidden="true" className="text-destructive h-3.5 w-3.5" />
                    )}
                    {changes > 0 && (
                      <Badge
                        aria-hidden="true"
                        variant="outline"
                        className="border-tint/40 bg-tint-fill px-1 py-0 tabular-nums"
                      >
                        {changes}
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </FacetMaterial>
    </header>
  );
});
