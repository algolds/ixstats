"use client";

import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import type { BuilderSection } from "../lib/builder-theme";
import { BuilderPreviewWidget } from "./BuilderPreviewWidget";
import { BuilderHelpWidget } from "./BuilderHelpWidget";
import { RefreshCw, XCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useBuilderContext } from "./enhanced/context/BuilderStateContext";
import { useBuilderFilter } from "./builder-filter-context";
import { useRouter } from "next/navigation";
import { createUrl } from "~/lib/url-utils";

interface BuilderSidebarLayoutProps {
  children: ReactNode;
  /** Hero section rendered above the grid */
  heroSection?: ReactNode;
  /** Sticky notch bar rendered below hero, above main content */
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
}

export function BuilderSidebarLayout({
  children,
  heroSection,
  notchBar,
  alerts,
  activeSection,
  onNavigate,
  completedSteps,
  accessibleSteps,
  mode = "create",
  heroCollapsed,
  onHeroExpand,
}: BuilderSidebarLayoutProps) {
  const { clearDraft } = useBuilderContext();
  const filter = useBuilderFilter();
  const router = useRouter();

  const handleResetClick = () => {
    if (mode === "edit") {
      const confirmExit = window.confirm(
        "Are you sure you want to discard your current edits and exit the editor?"
      );
      if (confirmExit) {
        clearDraft();
        router.push(createUrl("/mycountry"));
      }
    } else {
      const confirmReset = window.confirm(
        "Are you sure you want to restart the builder? This will clear all current progress and start fresh."
      );
      if (confirmReset) {
        clearDraft();
        filter.clearSelection();
        onNavigate("foundation");
      }
    }
  };

  return (
    <div className={cn("flex flex-col", !heroSection && "pt-[68px]")} data-builder-content>
      {/* Hero Section */}
      {heroSection && (
        <div className="container mx-auto px-4 pt-[6vh] lg:pt-[8vh]">{heroSection}</div>
      )}

      {/* Notch bar — sticky, sits just below DI, pushes content down */}
      {notchBar}

      {/* Alerts */}
      {alerts && (
        <div className="container mx-auto px-4 pt-4 sm:pt-6">
          <div className="mb-4 space-y-3 sm:mb-6">{alerts}</div>
        </div>
      )}

      {/* Main Layout */}
      <div
        className={cn(
          "container mx-auto flex gap-4 px-4 pb-4 sm:gap-6 sm:pb-6",
          !heroSection && !notchBar && "pt-16 lg:pt-20",
          notchBar && "pt-3",
          heroSection && !notchBar && "pt-6 lg:pt-8"
        )}
      >
        {/* Desktop Sidebar Nav (CutoutCard widgets) */}
        <div className="relative z-30 hidden shrink-0 lg:block lg:pt-8 lg:pr-2 lg:pl-6">
          <div className="space-y-4">
            {activeSection !== "import" && (
              <BuilderPreviewWidget
                heroCollapsed={heroCollapsed}
                onHeroExpand={onHeroExpand}
                activeSection={activeSection}
              />
            )}
            {activeSection === "import" ? (
              <div id="import-sidebar-portal" className="space-y-4" />
            ) : (
              <BuilderHelpWidget activeSection={activeSection} />
            )}

            {/* Sidebar actions: Reset / Restart */}
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetClick}
                className={cn(
                  "w-full text-xs font-semibold select-none",
                  "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-red-500/25 hover:bg-red-500/10 hover:text-red-400"
                )}
              >
                {mode === "edit" ? (
                  <>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Cancel Editing
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Restart Builder
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="min-w-0 flex-1 lg:pr-6 lg:pl-2">
          <div className="space-y-4">
            {children}

            {/* Mobile Actions: Reset / Restart */}
            <div className="block pt-4 text-center lg:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetClick}
                className={cn(
                  "px-6 text-xs font-semibold select-none",
                  "border-white/10 bg-white/[0.02] text-zinc-400 hover:border-red-500/25 hover:bg-red-500/10 hover:text-red-400"
                )}
              >
                {mode === "edit" ? (
                  <>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />
                    Cancel Editing
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    Restart Builder
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
