"use client";

import React, { Activity, ViewTransition, useId, useState } from "react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { ribbonPanelId, ribbonTabId } from "~/components/shared/document/DocumentRibbon";
import { useTheme } from "~/context/theme-context";
import { cn } from "~/lib/utils";
import { useNotify } from "~/hooks/useNotify";
import { UnifiedGlassCommandBar } from "./headers/UnifiedGlassCommandBar";
import { CommandDocument } from "./face/CommandDocument";
import { ExecutiveHome } from "./ExecutiveHome";
import { ExecutiveConsole } from "./ExecutiveConsole";
import { DomainSurface } from "./DomainSurface";
import { DrillSheets, type DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";
import { DOMAIN_META, DOMAIN_SECTIONS } from "./domain-meta";
import { tabForSection } from "./mycountry-tabs";

interface CommandSurfaceProps {
  section?: string;
  onNavigate?: (section: string) => void;
}

/** A domain section's suggested Directive goal (Economy, Diplomacy, Politics, Defense). */
function suggestedGoal(section: string): string | undefined {
  return Object.values(DOMAIN_META).find((meta) => meta.section === section)?.prefilledGoal;
}

export function CommandSurface({
  section = "overview",
  onNavigate,
}: CommandSurfaceProps): React.JSX.Element {
  const { country } = useCountryData();
  const { compactMode } = useTheme();
  const notify = useNotify();
  const countryId = country?.id ?? "";
  const idBase = `mycountry-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const [drill, setDrill] = useState<DrillSheetKind>(null);
  const [goal, setGoal] = useState("");
  // State, not a ref: the command bar re-observes the face's <h1> once the face has loaded.
  const [faceTitle, setFaceTitle] = useState<HTMLHeadingElement | null>(null);

  // The Directives section is the console; every Declare Directive leads there. On a domain
  // section the composer opens on that domain's suggested goal.
  const declare = (prefilled?: string) => {
    const next = prefilled ?? suggestedGoal(section);
    if (next) setGoal(next);
    if (section !== "executive") onNavigate?.("executive");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openIntent = (intentId: string) => {
    setDrill({ kind: "intent", intentId });
  };

  const openDrill = (d: DrillSheetKind) => {
    setDrill(d);
  };

  // Sections the player has opened stay mounted inside a hidden Activity, so returning to one is
  // instant and keeps its state. Activity tears effects down while hidden, so a section that is
  // out of view fires no toasts, timers or title writes. Anything that is not a domain section
  // renders the home surface, so it shares the "overview" slot. The Directives console replaces
  // every kept section while it shows, and a section is only mounted once it has been shown.
  // ponytail: at most 5 sections stay mounted; evict least recent if memory shows up in profiles
  const isDirectives = section === "executive";
  const shown = isDirectives ? null : DOMAIN_SECTIONS.has(section) ? section : "overview";
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set(shown ? [shown] : []));
  if (shown && !visited.has(shown)) setVisited(new Set(visited).add(shown));

  // Facet hierarchy: the command document (face + ribbon) is the page's card, the section below is
  // the ribbon's panel, and rows inside its cards are opaque depth-3 surfaces so blur never stacks.
  // The column runs from the sidebar to the right edge, capped at 1600px, like the country profile.
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[1600px] px-4 md:px-8",
        compactMode
          ? "pt-(--shell-top-offset) pb-4 md:py-5"
          : "pt-(--shell-top-offset) pb-6 md:py-8"
      )}
    >
      <UnifiedGlassCommandBar
        section={section}
        onNavigate={onNavigate}
        onDeclare={() => declare()}
        collapseOn={faceTitle}
      />

      <div className={compactMode ? "space-y-5" : "space-y-6"}>
        <CommandDocument
          section={section}
          onNavigate={onNavigate}
          onDeclare={() => declare()}
          idBase={idBase}
          titleRef={setFaceTitle}
        />

        <div
          role="tabpanel"
          id={ribbonPanelId(idBase)}
          aria-labelledby={ribbonTabId(idBase, tabForSection(section))}
        >
          {isDirectives ? (
            <ExecutiveConsole
              countryId={countryId}
              initialGoal={goal}
              onDone={(msg) => {
                // The Directives page shows the declared directive, so stay put.
                setGoal("");
                if (msg) notify.success("Directive committed", msg);
              }}
              onOpenDrill={openDrill}
            />
          ) : null}
          {/* Section switches are transitions, so the browser cross-fades the swap. The class hooks
              the fade in facet/interaction.css, which also turns it off under Reduce Motion. One
              wrapper is the transition's single host, and keeps the hidden sections (display: none)
              out of the column's space-y rhythm, which would count them as siblings. */}
          <ViewTransition default="mycountry-section">
            <div>
              {[...visited].map((s) => (
                <Activity key={s} mode={s === shown ? "visible" : "hidden"}>
                  {s === "overview" ? (
                    <ExecutiveHome
                      countryId={countryId}
                      onDeclare={declare}
                      onOpenIntent={openIntent}
                      onOpenDrill={openDrill}
                    />
                  ) : (
                    <DomainSurface countryId={countryId} section={s} onDeclare={declare} />
                  )}
                </Activity>
              ))}
            </div>
          </ViewTransition>
        </div>
      </div>

      {/* Drill Sheets */}
      <DrillSheets
        drill={drill}
        onClose={() => setDrill(null)}
        countryId={countryId}
        onDeclare={declare}
        onNavigate={onNavigate}
      />
    </div>
  );
}
