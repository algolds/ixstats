"use client";

import React, { useState, useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { useTheme } from "~/context/theme-context";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { useNotify } from "~/hooks/useNotify";
import { UnifiedGlassCommandBar } from "./headers/UnifiedGlassCommandBar";
import { ExecutiveHome } from "./ExecutiveHome";
import { ExecutiveConsole } from "./ExecutiveConsole";
import { DomainSurface } from "./DomainSurface";
import { DrillSheets, type DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";
import { DOMAIN_SECTIONS } from "./domain-meta";
import type { CommandNavMode } from "./command-nav-mode";

interface CommandSurfaceProps {
  section?: string;
  onNavigate?: (section: string) => void;
}

function CommandSurfaceComponent({
  section = "overview",
  onNavigate,
}: CommandSurfaceProps): React.JSX.Element {
  const { country } = useCountryData();
  const { compactMode } = useTheme();
  const notify = useNotify();
  const countryId = country?.id ?? "";

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drill, setDrill] = useState<DrillSheetKind>(null);
  const [goal, setGoal] = useState("");

  // The console is a URL state (?mode=executive), not component state: the sidebar Overview
  // link (/mycountry, no param) must reset to home even when we are already on that path,
  // and back/forward must move between home and the console. The executive section is the
  // console by definition; domain surfaces never show it.
  const mode: CommandNavMode =
    section === "executive" ||
    (!DOMAIN_SECTIONS.has(section) && searchParams.get("mode") === "executive")
      ? "executive"
      : "home";

  // Same history pattern as MyCountryRouter: write the URL without a Next route transition.
  // useSearchParams follows pushState/replaceState, so the surface re-renders from the URL.
  const setMode = useCallback(
    (next: CommandNavMode, options?: { replace?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next === "executive") params.set("mode", "executive");
      else params.delete("mode");
      const query = params.toString();
      const href = withBasePath(query ? `${pathname}?${query}` : pathname);
      if (options?.replace) window.history.replaceState(null, "", href);
      else window.history.pushState(null, "", href);
    },
    [pathname, searchParams]
  );

  const declare = useCallback(
    (prefilled?: string) => {
      if (prefilled) setGoal(prefilled);
      if (section !== "executive" && section !== "overview") {
        // Domain surfaces hand over to the Directives section, which is the console.
        onNavigate?.("executive");
      } else if (section === "overview" && mode !== "executive") {
        // Already on ?mode=executive: another push would add a duplicate history entry.
        setMode("executive");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [mode, onNavigate, section, setMode]
  );

  const openIntent = useCallback((intentId: string) => {
    setDrill({ kind: "intent", intentId });
  }, []);

  const openDrill = useCallback((d: DrillSheetKind) => {
    setDrill(d);
  }, []);

  // Facet hierarchy: the command bar is the shell (depth 1), each section below is a card
  // (depth 2), and rows inside a card are opaque depth-3 surfaces so blur never stacks.
  // The column is the app's standard page column (`max-w-6xl`, `p-4` phone, `p-8` from md), so
  // MyCountry's left edge lines up with every other page; compact mode only tightens the rhythm.
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-6xl px-4 md:px-8",
        compactMode ? "space-y-5 py-4 md:py-5" : "space-y-6 py-4 md:py-8"
      )}
    >
      {/* Permanent Unified Glass Command Bar */}
      <UnifiedGlassCommandBar mode={mode} onChangeMode={setMode} onDeclare={() => declare()} />

      {/* Main Surface Body */}
      {mode === "executive" ? (
        <ExecutiveConsole
          countryId={countryId}
          initialGoal={goal}
          onDone={(msg) => {
            // On the Directives page itself, stay put: it shows the declared directive.
            if (section !== "executive") setMode("home", { replace: true });
            setGoal("");
            if (msg) notify.success("Directive committed", msg);
          }}
          onOpenDrill={openDrill}
        />
      ) : DOMAIN_SECTIONS.has(section) ? (
        <DomainSurface
          countryId={countryId}
          section={section}
          onDeclare={declare}
          onNavigate={onNavigate}
        />
      ) : (
        <ExecutiveHome
          countryId={countryId}
          onDeclare={declare}
          onNavigate={onNavigate}
          onOpenIntent={openIntent}
          onOpenDrill={openDrill}
        />
      )}

      {/* Drill Sheets */}
      <DrillSheets
        drill={drill}
        onClose={() => setDrill(null)}
        countryId={countryId}
        onDeclare={declare}
      />
    </div>
  );
}

export const CommandSurface = React.memo(CommandSurfaceComponent);
