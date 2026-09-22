"use client";

import React, { memo } from "react";
import {
  Search,
  Xmark as X,
  HelpCircle,
  Bell,
  Settings,
} from "iconoir-react";
import { BuilderProgressView } from "./BuilderProgressView";
import type { DIViewProps, ViewMode } from "~/components/halo/types";
import type { BuilderFilterState } from "~/app/builder/components/builder-filter-context";
import type { BuilderContextValue } from "~/app/builder/components/enhanced/context/BuilderStateContext";
import type { RealCountryData } from "~/app/builder/lib/economy-types";

/**
 * Upgrades a flag URL to a high-resolution or SVG version if it is from FlagCDN or Wikimedia Commons.
 */
function getHighResFlagUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;

  if (url.includes("flagcdn.com")) {
    return url.replace(/\/w\d+\/([a-z0-9_-]+)\.(png|jpg|jpeg|gif|webp)$/i, "/$1.svg");
  }

  if (url.includes("upload.wikimedia.org/wikipedia/commons/thumb/")) {
    const parts = url.split("/");
    if (parts[5] === "thumb") {
      parts.splice(5, 1);
      parts.pop();
      return parts.join("/");
    }
  }

  return url;
}

export type BuilderViewProps = DIViewProps<BuilderFilterState, BuilderContextValue>;

function BuilderViewComponent({ onClose, onSwitchMode, filter, context }: BuilderViewProps) {
  const activeTemplate =
    filter?.selectedTemplate ||
    context?.builderState?.selectedCountry ||
    (context?.builderState?.economicInputs?.countryName
      ? {
          name: context.builderState.economicInputs.countryName,
          flag: context.builderState.economicInputs.flagUrl || "",
          flagUrl: context.builderState.economicInputs.flagUrl || "",
        }
      : null);

  const rawFlagUrl =
    activeTemplate?.flag ||
    activeTemplate?.flagUrl ||
    filter?.softSelectedCountry?.flag ||
    filter?.softSelectedCountry?.flagUrl;
  const flagUrl = getHighResFlagUrl(rawFlagUrl);

  return (
    <div className="relative flex w-full flex-col p-4 text-left text-foreground select-none sm:p-5">
      {/* Background Refracted Flag Watermark */}
      {flagUrl && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] select-none">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.12] blur-[6px] saturate-[85%] transition-all duration-700 dark:opacity-[0.06] dark:saturate-[50%]"
            style={{ backgroundImage: `url(${flagUrl})` }}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/10 mix-blend-overlay" />
        </div>
      )}

      {/* Top Header */}
      <div className="relative z-10 mb-2 flex items-center justify-end pb-1">
        <div className="flex items-center gap-1.5">
          {onSwitchMode && (
            <>
              <button
                onClick={() => onSwitchMode("search" as ViewMode)}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-accent/20 hover:text-foreground active:scale-[0.97]"
                title="Global Search"
                type="button"
                data-cuelume-press
              >
                <Search className="h-4 w-4" />
              </button>
              <button
                onClick={() => onSwitchMode("notifications" as ViewMode)}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-accent/20 hover:text-foreground active:scale-[0.97]"
                title="Notifications"
                type="button"
                data-cuelume-press
              >
                <Bell className="h-4 w-4" />
              </button>
              <button
                onClick={() => onSwitchMode("settings" as ViewMode)}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-accent/20 hover:text-foreground active:scale-[0.97]"
                title="Settings"
                type="button"
                data-cuelume-press
              >
                <Settings className="h-4 w-4" />
              </button>
            </>
          )}
          {filter && (
            <button
              onClick={() => filter.setWelcomeModalOpen(true)}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-amber-500/15 hover:text-amber-400 active:scale-[0.97]"
              title="Open Welcome Guide"
              type="button"
              data-cuelume-press
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-all duration-150 hover:bg-accent/20 hover:text-foreground active:scale-[0.97]"
            title="Collapse Hero"
            type="button"
            data-cuelume-press
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Standard Builder Companion & Progress View */}
      <BuilderProgressView filter={filter} context={context} onClose={onClose} />
    </div>
  );
}

export const BuilderView = memo(BuilderViewComponent);
BuilderView.displayName = "BuilderView";

// Backwards compatibility alias
export const BuilderDIView = BuilderView;
