"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Crown, ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { GlassButton } from "~/components/ui/glass-button";
import { MyCountryEditModeProvider } from "~/context/MyCountryEditModeContext";
import { GlassPanel } from "~/components/mycountry/cards";
import type { MyCountryAccent } from "~/components/mycountry/shared/cards/accents";

interface PremiumPreviewFrameProps {
  feature: "intelligence" | "defense";
  /** True when the current user is NOT premium (render real content, read-only). */
  locked: boolean;
  children: React.ReactNode;
  onUpgrade?: () => void;
}

const FEATURE_META: Record<
  PremiumPreviewFrameProps["feature"],
  { label: string; accent: MyCountryAccent; blurb: string }
> = {
  intelligence: {
    label: "Intelligence",
    accent: "blue",
    blurb: "You're viewing a live preview. Upgrade to act on briefings and unlock secure tools.",
  },
  defense: {
    label: "Defense",
    accent: "red",
    blurb: "You're viewing a live preview. Upgrade to build forces and launch operations.",
  },
};

/**
 * PremiumPreviewFrame — read-only premium preview.
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
        <GlassPanel
          accent={meta.accent}
          texture="none"
          className={cn("sticky top-2 z-30 px-3 py-2.5 sm:px-4")}
        >
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 p-2 shadow-sm">
              <Crown className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-sm font-semibold">{meta.label} preview</span>
              </div>
              <p className="text-muted-foreground truncate text-xs">{meta.blurb}</p>
            </div>
            <GlassButton variant="primary" className="group shrink-0" onClick={handleUpgrade}>
              <Crown className="mr-1.5 h-3.5 w-3.5" />
              Upgrade
              <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </GlassButton>
          </div>
        </GlassPanel>

        {children}
      </div>
    </MyCountryEditModeProvider>
  );
}
