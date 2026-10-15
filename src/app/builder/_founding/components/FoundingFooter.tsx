"use client";

import { NavArrowLeft, StatsUpSquare } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet/shared/FacetMaterial";
import type { DraftSaveStatus } from "../hooks/useFoundingDraft";

/** The draft's state in words: "Draft saved", "Saving…", "Could not save your draft · Retry". */
export function DraftStatus({
  status,
  resumed,
  onRetry,
}: {
  status: DraftSaveStatus;
  resumed: boolean;
  onRetry: () => void;
}) {
  if (status === "error") {
    return (
      <div role="alert" className="text-footnote text-destructive flex items-center gap-1">
        <span>Could not save your draft</span>
        <span aria-hidden>·</span>
        <Button type="button" variant="link" size="xs" className="h-auto px-0" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  const text =
    status === "pending" || status === "saving"
      ? "Saving…"
      : status === "saved" || resumed
        ? "Draft saved"
        : "Your draft saves as you go";
  return (
    <p role="status" className="text-footnote text-label-secondary">
      {text}
    </p>
  );
}

interface FoundingFooterProps {
  canGoBack: boolean;
  onBack: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  onOpenNation: () => void;
  status: DraftSaveStatus;
  resumed: boolean;
  onRetry: () => void;
}

/**
 * The one way to move through founding: Back, the step's one primary action, the draft's status,
 * and (below xl, where the nation card is a sheet) the Nation button. Sticky above the tab bar so
 * it stays in thumb reach.
 */
export function FoundingFooter({
  canGoBack,
  onBack,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  onOpenNation,
  status,
  resumed,
  onRetry,
}: FoundingFooterProps) {
  return (
    <FacetMaterial
      layer="chrome"
      data-slot="founding-footer"
      className="z-sticky sticky bottom-[calc(var(--shell-tabbar-height)+0.5rem)] flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2"
    >
      <Button type="button" variant="ghost" onClick={onBack} disabled={!canGoBack}>
        <NavArrowLeft aria-hidden />
        Back
      </Button>
      <div className="order-last basis-full px-1 sm:order-none sm:flex-1 sm:basis-auto">
        <DraftStatus status={status} resumed={resumed} onRetry={onRetry} />
      </div>
      <Button
        type="button"
        variant="outline"
        className="ml-auto sm:ml-0 xl:hidden"
        onClick={onOpenNation}
      >
        <StatsUpSquare aria-hidden />
        Nation
      </Button>
      <Button type="button" onClick={onPrimary} disabled={primaryDisabled}>
        {primaryLabel}
      </Button>
    </FacetMaterial>
  );
}
