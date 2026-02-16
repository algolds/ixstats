"use client";

import { Users } from "lucide-react";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { api } from "~/trpc/react";
import { AllianceCreationWizard } from "./alliances/AllianceCreationWizard";
import { AllianceDashboard } from "./alliances/AllianceDashboard";

interface AlliancesPanelProps {
  countryId: string;
}

export function AlliancesPanel({ countryId }: AlliancesPanelProps) {
  const { data: alliances, refetch } = api.diplomatic.getAlliances.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-semibold">Alliances & Blocs</h3>
          <SectionHelpIcon
            title="Alliances & Blocs"
            content="Form and manage alliances with other nations. Alliances provide mutual defense benefits, trade advantages, and diplomatic leverage. Create a new alliance or manage your existing memberships."
          />
        </div>
        <AllianceCreationWizard onSuccess={() => void refetch()} />
      </div>

      {/* Alliance list */}
      {!alliances || alliances.length === 0 ? (
        <div className="rounded-lg border border-dashed border-cyan-500/30 p-6 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-cyan-500/40" />
          <p className="text-muted-foreground text-sm">
            Not a member of any alliances. Create one or wait for an invitation.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alliances.map((alliance) => (
            <AllianceDashboard
              key={alliance.id}
              allianceId={alliance.id}
              countryId={countryId}
              myRole={alliance.myRole}
              onLeave={() => void refetch()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
