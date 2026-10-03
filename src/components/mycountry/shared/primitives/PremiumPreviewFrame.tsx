"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Crown, ArrowRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { MyCountryEditModeProvider } from "~/context/MyCountryEditModeContext";
import { Card } from "~/components/ui/card";

interface PremiumPreviewFrameProps {
  feature: "intelligence" | "defense";
  /** True when the current user is NOT premium (render real content, read-only). */
  locked: boolean;
  children: React.ReactNode;
  onUpgrade?: () => void;
}

const FEATURE_META: Record<PremiumPreviewFrameProps["feature"], { label: string; blurb: string }> =
  {
    intelligence: {
      label: "Intelligence",
      blurb: "Read-only preview. Upgrade to act on briefings.",
    },
    defense: {
      label: "Defense",
      blurb: "Read-only preview. Upgrade to build forces and launch operations.",
    },
  };

/**
 * Read-only premium preview.
 *
 * When `locked`, renders the REAL section content (render-time queries are
 * public/protected, safe for any signed-in user) but provides `canEdit=false`
 * via MyCountryEditModeContext, so mutation CTAs show an upgrade prompt instead
 * of firing. A sticky banner explains the preview + offers the upgrade. When not
 * locked, it's a transparent passthrough with editing enabled.
 */
export function PremiumPreviewFrame({
  feature,
  locked,
  children,
  onUpgrade,
}: PremiumPreviewFrameProps) {
  const router = useRouter();
  const meta = FEATURE_META[feature];

  if (!locked) {
    return <MyCountryEditModeProvider canEdit={true}>{children}</MyCountryEditModeProvider>;
  }

  const handleUpgrade = onUpgrade ?? (() => router.push("/help/getting-started/welcome"));

  return (
    <MyCountryEditModeProvider canEdit={false} reason="premium">
      <div className="space-y-3 sm:space-y-4">
        <Card className="sticky top-(--shell-top-offset) z-30 px-3 py-2 sm:px-4">
          <div className="flex items-center gap-3">
            <Crown aria-hidden="true" className="text-yellow h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-label text-headline">{meta.label} preview</span>
              <p className="text-label-secondary text-footnote truncate">{meta.blurb}</p>
            </div>
            <Button variant="default" size="sm" className="shrink-0" onClick={handleUpgrade}>
              Upgrade
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>

        {children}
      </div>
    </MyCountryEditModeProvider>
  );
}
