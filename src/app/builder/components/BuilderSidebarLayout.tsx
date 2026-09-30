"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import type { BuilderSection } from "../lib/builder-theme";
import { Refresh as RefreshCw, XmarkCircle as XCircle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { useBuilderFilter } from "./builder-filter-context";
import { useRouter } from "next/navigation";
import { createUrl } from "~/lib/utils";
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
  // oxlint-disable-next-line eslint/no-unused-vars
  completedSteps: _completedSteps,
  // oxlint-disable-next-line eslint/no-unused-vars
  accessibleSteps: _accessibleSteps,
  mode = "create",
  // oxlint-disable-next-line eslint/no-unused-vars
  heroCollapsed: _heroCollapsed,
  // oxlint-disable-next-line eslint/no-unused-vars
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
      router.push(createUrl("/mycountry"));
    } else {
      filter.clearSelection();
      _onNavigate("foundation");
    }
  };

  const headerElement = studioHeader || notchBar;

  return (
    <div
      className={cn(
        "flex min-h-[calc(100vh-1px)] w-full flex-1 flex-col",
        "pt-24 sm:pt-28 lg:pt-32"
      )}
      data-builder-content
    >
      {/* Hero Section */}
      {heroSection && (
        <div className="container mx-auto px-4 pt-2 sm:pt-4">{heroSection}</div>
      )}

      {/* Docked Studio Header (Non-sticky, directly in normal flow above main container) */}
      {headerElement}

      {/* Alerts */}
      {alerts && (
        <div className="container mx-auto px-4 pt-2 empty:hidden">
          <div className="space-y-2 empty:hidden">{alerts}</div>
        </div>
      )}

      {/* Main Studio Canvas — Seamlessly Centered Across All Steps */}
      <main
        className={cn(
          "mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col px-4 pb-8",
          headerElement ? "pt-2 sm:pt-3" : "pt-4 sm:pt-6"
        )}
      >
        <div className="flex h-full min-h-0 w-full flex-1 flex-col space-y-4">
          {children}

          {/* Dedicated Step Footer Navigation */}
          {stepFooter}

          {/* Fallback Footer Reset Action (only when stepFooter not provided) */}
          {!stepFooter && activeSection !== "foundation" && (
            <div className="pt-8 pb-4 text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetClick}
                data-cuelume-press
                className={cn(
                  "px-4 text-xs font-medium select-none transition-colors active:scale-[0.98]",
                  "text-muted-foreground/60 hover:border-red-500/20 hover:bg-red-500/10 hover:text-red-400"
                )}
              >
                {mode === "edit" ? (
                  <>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Discard Changes & Exit Editor
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Restart Builder from Scratch
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

export { BuilderSidebarLayout as BuilderStudioLayout };

