"use client";

import React from "react";
import { X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CrisisIndicator, CrisisActionButtons, type CrisisEvent } from "./CrisisIndicator";
import { usePermissions } from "~/hooks/usePermissions";
import { getUserInterfacePreferences } from "~/lib/interface-routing";

interface CrisisViewProps {
  crises: CrisisEvent[];
  onClose: () => void;
}

export function CrisisView({ crises, onClose }: CrisisViewProps) {
  const { permissions, user } = usePermissions();

  // Check if user can access SDI/ECI based on permissions
  const userProfile = user ? {
    id: user.id,
    role: (user.role?.name as "admin" | "dm" | "observer" | "user") || "user",
    countryId: undefined, // Will be set from user data if available
  } : null;

  const interfacePrefs = userProfile ? getUserInterfacePreferences(userProfile) : { canAccessSDI: false, canAccessECI: false };
  const canAccessSDI = interfacePrefs.canAccessSDI;
  const canAccessECI = interfacePrefs.canAccessECI;

  return (
    <div
      className="relative w-full rounded-xl p-6"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">Crisis Monitor</h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground hover:bg-accent/10 h-8 w-8 rounded-full p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Crisis Indicator - Full variant */}
      <div className="mb-4">
        <CrisisIndicator crises={crises} variant="full" />
      </div>

      {/* Action Buttons */}
      {(canAccessSDI || canAccessECI) && (
        <div className="border-t border-white/10 pt-4">
          <div className="mb-2 text-xs font-medium text-muted-foreground">Quick Actions</div>
          <CrisisActionButtons canAccessSDI={canAccessSDI} canAccessECI={canAccessECI} />
        </div>
      )}

      {/* Help Text */}
      <div className="mt-4 rounded-lg bg-white/5 p-3">
        <p className="text-xs text-muted-foreground">
          Crisis events are monitored in real-time. Use the SDI Dashboard for strategic intelligence
          or the Executive Command for immediate response actions.
        </p>
      </div>
    </div>
  );
}
