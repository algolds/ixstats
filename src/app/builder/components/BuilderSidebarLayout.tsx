"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import type { BuilderSection } from "../lib/builder-theme";
import { Refresh as RefreshCw, XmarkCircle as XCircle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { useBuilderFilter } from "./builder-filter-context";
import { useRouter } from "next/navigation";
import { soundEffects } from "~/lib/sound/cuelume";

interface BuilderSidebarLayoutProps {
  children: ReactNode;
  /** Hero section rendered above the studio header */
  heroSection?: ReactNode;
  /** Sticky studio header docked cleanly above main content */
  studioHeader?: ReactNode;
  /** Grounded step footer rendered at bottom of main content */
  stepFooter?: ReactNode;
  /** Deprecated: Sticky notch bar */
  notchBar?: ReactNode;
  /** Alerts/banners rendered above main content */
  alerts?: ReactNode;
  /** Active builder section */
  activeSection: BuilderSection;
  /** Callback for sidebar nav clicks */
  onNavigate: (section: BuilderSection) => void;
  /** Which steps have been completed */
  completedSteps?: Set<BuilderSection>;
  /** Which steps can be accessed */
  accessibleSteps?: Set<BuilderSection>;
  /** Builder mode: 'create' or 'edit' */
  mode?: "create" | "edit";
  heroCollapsed?: boolean;
  onHeroExpand?: () => void;
  onReset?: () => void;
}

export function BuilderSidebarLayout({
  children,
  heroSection,
  studioHeader,
  stepFooter,
  notchBar,
  alerts,
  activeSection,
  onNavigate: _onNavigate,
  completedSteps: _completedSteps,
  accessibleSteps: _accessibleSteps,
  mode = "create",
  heroCollapsed: _heroCollapsed,
  onHeroExpand: _onHeroExpand,
  onReset,
}: BuilderSidebarLayoutProps) {
  const { clearDraft } = useBuilderContext();
  const filter = useBuilderFilter();
  const router = useRouter();

  const handleResetClick = () => {
    if (onReset) {
      onReset();
      return;
    }
    soundEffects.press();
    clearDraft();
    if (mode === "edit") {
      router.push("/mycountry");
    } else {
      filter.clearSelection();
      _onNavigate("foundation");
    }
  };

  const headerElement = studioHeader || notchBar;

  return (
    <div className="flex min-h-[calc(100vh-1px)] w-full flex-1 flex-col">
      {heroSection && <div className="container mx-auto px-4 pt-2 sm:pt-4">{heroSection}</div>}

      {/* Docked Studio Header (Non-sticky, directly in normal flow above main container) */}
      {headerElement}

      {alerts && (
        <div className="mx-auto w-full max-w-6xl px-4 pt-2 empty:hidden">
          <div className="space-y-2 empty:hidden">{alerts}</div>
        </div>
      )}

      <main
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pb-8",
          headerElement ? "pt-2 sm:pt-3" : "pt-4 sm:pt-6"
        )}
      >
        <div className="flex h-full min-h-0 w-full flex-1 flex-col space-y-4">
          {children}

          {stepFooter}

          {/* Fallback Footer Reset Action (only when stepFooter not provided) */}
          {!stepFooter && activeSection !== "foundation" && (
            <div className="pt-8 pb-4 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetClick}
                className="text-label-secondary hover:bg-destructive/10 hover:text-destructive text-caption px-4 select-none"
              >
                {mode === "edit" ? (
                  <>
                    <XCircle className="mr-2 h-3.5 w-3.5" />
                    Discard changes and exit
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Restart builder
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
