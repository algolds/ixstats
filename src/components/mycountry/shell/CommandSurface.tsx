"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useCountryData } from "~/components/mycountry/shared/primitives";
import { useTheme } from "~/context/theme-context";
import { cn } from "~/lib/utils";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { api } from "~/trpc/react";
import { CommandNavToggle, CommandRightPillNav, type CommandNavMode } from "./CommandNavToggle";
import { ExecutiveHome } from "./ExecutiveHome";
import { ExecutiveConsole } from "./ExecutiveConsole";
import { DomainSurface } from "./DomainSurface";
import { DrillSheets, type DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";
import { DOMAIN_SECTIONS } from "./domain-meta";

export interface CommandSurfaceProps {
  section?: string;
  onNavigate?: (section: any) => void;
}

function CommandSurfaceComponent({
  section = "overview",
  onNavigate,
}: CommandSurfaceProps): React.JSX.Element {
  const { country } = useCountryData();
  const { compactMode } = useTheme();
  const countryId = country?.id ?? "";

  const [mode, setMode] = useState<CommandNavMode>("home");
  const [drill, setDrill] = useState<DrillSheetKind>(null);
  const [goal, setGoal] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const navRef = useRef<HTMLDivElement>(null);

  // Sync mode with route section: set executive mode if on executive section, or reset to home when navigating to a specific domain surface
  useEffect(() => {
    if (section === "executive") {
      setMode("executive");
    } else if (DOMAIN_SECTIONS.has(section)) {
      setMode("home");
    }
  }, [section]);

  const declare = useCallback(
    (prefilled?: string) => {
      if (prefilled) setGoal(prefilled);
      setMode("executive");
      if (section !== "overview") {
        onNavigate?.("overview");
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [onNavigate, section]
  );

  const openIntent = useCallback((intentId: string) => {
    setDrill({ kind: "intent", intentId });
  }, []);

  const openDrill = useCallback((d: DrillSheetKind) => {
    setDrill(d);
  }, []);

  return (
    <div
      className={cn(
        "mx-auto w-full transition-all duration-300 ease-out",
        compactMode
          ? "max-w-6xl space-y-5 px-4 py-4 sm:px-6 sm:py-5"
          : "max-w-[1600px] space-y-6 px-4 py-4 sm:px-6 sm:py-6 lg:px-8"
      )}
    >
      {/* Top Mirrored Pill Bar */}
      <div ref={navRef} className="flex items-center justify-between gap-3">
        <CommandNavToggle
          mode={mode}
          activeSection={section}
          onChangeMode={(m) => {
            setMode(m);
            if (m === "home" || m === "executive") {
              onNavigate?.("overview");
            }
          }}
          onNavigate={onNavigate}
        />
        <CommandRightPillNav country={country} />
      </div>

      {/* Main Surface Body */}
      {mode === "executive" ? (
        <ExecutiveConsole
          countryId={countryId}
          initialGoal={goal}
          onDone={(msg) => {
            setMode("home");
            setGoal("");
            if (msg) {
              setToast(msg);
              setTimeout(() => setToast(null), 5000);
            }
          }}
        />
      ) : DOMAIN_SECTIONS.has(section) ? (
        <DomainSurface countryId={countryId} section={section as any} onDeclare={declare} />
      ) : (
        <ExecutiveHome
          countryId={countryId}
          onDeclare={declare}
          onOpenIntent={openIntent}
          onOpenDrill={openDrill}
          onNavigate={onNavigate}
        />
      )}

      {/* Drill Sheets */}
      <DrillSheets
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

export const CommandSurface = React.memo(CommandSurfaceComponent);
