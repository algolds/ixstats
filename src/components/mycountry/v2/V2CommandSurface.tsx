"use client";

import { useState, useCallback } from "react";
import { useCountryData } from "../primitives";
import { OverviewHero } from "../OverviewHero";
import { StateSeal } from "../primitives";
import { useHeroCollapsed } from "~/hooks/useHeroCollapsed";
import { api } from "~/trpc/react";
import { V2ModeToggle, type V2Mode } from "./V2ModeToggle";
import { V2Home } from "./V2Home";
import { V2Console } from "./V2Console";
import { V2DrillSheets, type V2Drill } from "./V2DrillSheets";

/**
 * The v2 command surface (migration §2). When v2 is active this replaces the
 * legacy sidebar/section war-rooms entirely:
 *   - HOME  — the action command surface (briefing + action grid + feed + rail)
 *   - CONSOLE — Executive mode: declare an Intent (the composer, primary)
 *   - DRILL-DOWNS — right-side sheets for depth (intent detail, relations, …)
 * No sidebar, one navigator, everything ≤1 click.
 */
export function V2CommandSurface() {
  const { country } = useCountryData();
  const countryId = country?.id ?? "";

  const { collapsed, setCollapsed } = useHeroCollapsed(true, country?.id);
  const [mode, setMode] = useState<V2Mode>("home");
  const [drill, setDrill] = useState<V2Drill>(null);
  const [goal, setGoal] = useState("");
  const [toast, setToast] = useState<string | null>(null);

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

  const declare = useCallback(
    (prefilled?: string) => {
      setGoal(prefilled ?? "");
      setMode("console");
    },
    []
  );

  const openDrill = useCallback((d: V2Drill) => setDrill(d), []);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-5">
      {/* Collapsed-by-default hero — action bar carries Directive + Edit */}
      {country && (
        <OverviewHero
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          countryId={country.id}
          v2
          onIssueDirective={() => declare()}
        />
      )}

      <V2ModeToggle mode={mode} onChange={setMode} />

      {mode === "home" ? (
        <V2Home
          countryId={countryId}
          onDeclare={() => declare()}
          onOpenDrill={openDrill}
          onOpenIntent={(id) => openDrill({ kind: "intent", intentId: id })}
        />
      ) : (
        <V2Console countryId={countryId} onCommitted={handleCommitted} />
      )}

      <V2DrillSheets drill={drill} onClose={() => setDrill(null)} countryId={countryId} />

      {/* Committed toast */}
      {toast && (
        <div className="border-border bg-secondary animate-in fade-in slide-in-from-bottom-2 fixed bottom-5 left-1/2 z-50 flex max-w-lg -translate-x-1/2 items-start gap-2.5 rounded-xl border px-4 py-3 shadow-2xl">
          <StateSeal
            flagUrl={country?.flag}
            governmentType={country?.governmentType}
            size={24}
            showPips={false}
            className="mt-0.5"
          />
          <span className="text-foreground/90 text-[13px] leading-snug">{toast}</span>
        </div>
      )}
    </div>
  );
}