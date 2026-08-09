"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useCountryData } from "../primitives";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { api } from "~/trpc/react";
import { V2ModeToggle, V2RightPillNav, type V2Mode } from "./V2ModeToggle";
import { V2Home } from "./V2Home";
import { V2Console } from "./V2Console";
import { V2DomainSurface } from "./V2DomainSurface";
import { V2DrillSheets, type V2Drill } from "./V2DrillSheets";
import { DOMAIN_SECTIONS } from "./domain-meta";

import type { MyCountrySection } from "../MyCountrySidebarNav";

/**
 * The v2 command surface (migration §2). When v2 is active this replaces the
 * legacy sidebar/section war-rooms entirely:
 *   - HOME  — the action command surface (command briefing hero + action grid + feed + rail)
 *   - DOMAIN — full-page domain surfaces for diplomacy / defense / politics / economy routes
 *   - CONSOLE — Executive mode: declare an Intent (the composer, primary)
 *   - DRILL-DOWNS — right-side sheets for depth (intent detail, relations, …)
 * Single unified navigation pill, everything ≤1 click.
 */
export function V2CommandSurface({
  section = "overview",
  onNavigate,
}: {
  section?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
} = {}) {
  const { country } = useCountryData();
  const countryId = country?.id ?? "";

  const [mode, setMode] = useState<V2Mode>("home");
  const [drill, setDrill] = useState<V2Drill>(null);
  const [goal, setGoal] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const navRef = useRef<HTMLDivElement>(null);

  // Automatically start viewport directly below the top nav bar on mount / navigation.
  // Scrolling up (swiping down towards top of page) reveals the nav bar above.
  useEffect(() => {
    if (navRef.current) {
      const navHeight = navRef.current.getBoundingClientRect().height;
      if (navHeight > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: navHeight + 16, behavior: "instant" });
        });
      }
    }
  }, [section, mode]);

  const utils = api.useUtils();
  const handleCommitted = useCallback(
    (res: any) => {
      const body = (res?.summary as string) ?? "Directive committed.";
      setToast(body);
      setTimeout(() => setToast(null), 4500);
      // Invalidate the surfaces that reflect a committed directive.
      void utils.mycountry.getCanonFeed.invalidate();
      void utils.mycountry.getChangeLog.invalidate();
      void utils.mycountry.getCountryDashboard.invalidate();
      void utils.intent.getStatus.invalidate();
      void utils.intent.getTree.invalidate();
    },
    [utils]
  );

  const declare = useCallback((prefilled?: string) => {
    setGoal(typeof prefilled === "string" ? prefilled : "");
    setMode("console");
  }, []);

  const openDrill = useCallback((d: V2Drill) => setDrill(d), []);

  const isDomainSection = DOMAIN_SECTIONS.has(section);

  return (
    <div className="container mx-auto space-y-5 px-3 py-3 sm:px-4 sm:py-4">
      {/* Primary Navigation Row (Left & Right Mirrored Navigation Pills) */}
      <div ref={navRef} className="flex flex-wrap items-center justify-between gap-3">
        <V2ModeToggle mode={mode} onChangeMode={setMode} />
        <V2RightPillNav onNavigate={onNavigate} />
      </div>

      {mode === "console" ? (
        <V2Console countryId={countryId} initialGoal={goal} onCommitted={handleCommitted} />
      ) : isDomainSection ? (
        <V2DomainSurface
          countryId={countryId}
          section={section as "diplomacy" | "defense" | "politics" | "economy"}
          onDeclare={declare}
        />
      ) : (
        <V2Home
          countryId={countryId}
          onDeclare={(prefilled?: string) => declare(prefilled)}
          onOpenDrill={openDrill}
          onOpenIntent={(id) => openDrill({ kind: "intent", intentId: id })}
          onNavigate={onNavigate}
        />
      )}

      <V2DrillSheets
        drill={drill}
        onClose={() => setDrill(null)}
        countryId={countryId}
        onDeclare={declare}
      />

      {/* Committed toast */}
      {toast && (
        <div className="border-border bg-secondary animate-in fade-in slide-in-from-bottom-2 fixed bottom-5 left-1/2 z-50 flex max-w-lg -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl">
          <MyCountryLogo size="sm" variant="icon-only" animated={true} />
          <span className="text-foreground/90 text-[13px] leading-snug">{toast}</span>
        </div>
      )}
    </div>
  );
}
