"use client";

import React, { memo } from "react";
import { Search, Xmark as X, HelpCircle, Bell, Settings } from "iconoir-react";
import { BuilderProgressView } from "./BuilderProgressView";
import type { DIViewProps, ViewMode } from "~/components/halo/types";
import type { BuilderFilterState } from "~/app/builder/components/builder-filter-context";
import type { BuilderContextValue } from "~/app/builder/components/enhanced/context/BuilderStateContext";
import type { RealCountryData } from "~/types/builder";
import { Button } from "~/components/ui/button";

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
    <div className="text-label relative flex w-full flex-col p-4 text-left select-none sm:p-5">
      {/* Background Refracted Flag Watermark */}
      {flagUrl && (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit] select-none">
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-[0.12] blur-[6px] saturate-[85%] transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150"
            style={{ backgroundImage: `url(${flagUrl})` }}
          />
        </div>
      )}

      {/* Top Header */}
      <div className="relative z-10 mb-2 flex items-center justify-end pb-1">
        <div className="flex items-center gap-2">
          {onSwitchMode && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onSwitchMode("search" as ViewMode)}
                className="text-label-secondary hover:text-label"
                title="Search"
                type="button"
                aria-label="Search"
              >
                <Search aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onSwitchMode("notifications" as ViewMode)}
                className="text-label-secondary hover:text-label"
                title="Notifications"
                type="button"
                aria-label="Notifications"
              >
                <Bell aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onSwitchMode("settings" as ViewMode)}
                className="text-label-secondary hover:text-label"
                title="Settings"
                type="button"
                aria-label="Settings"
              >
                <Settings aria-hidden />
              </Button>
            </>
          )}
          {filter && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => filter.setWelcomeModalOpen(true)}
              className="text-label-secondary hover:text-yellow"
              title="Open welcome guide"
              type="button"
              aria-label="Open welcome guide"
            >
              <HelpCircle aria-hidden />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-label-secondary hover:text-label"
            title="Collapse"
            type="button"
            aria-label="Collapse"
          >
            <X aria-hidden />
          </Button>
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
