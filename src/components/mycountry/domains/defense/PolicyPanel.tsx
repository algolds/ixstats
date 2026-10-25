"use client";

import { Skeleton } from "~/components/ui/skeleton";
import { useCanEdit } from "~/context/MyCountryEditModeContext";
import { useClockNow, useNationClock } from "~/hooks/useNationClock";
import { useBranchLevers, useDefenseLevers, useDefenseOverview } from "~/hooks/useDefenseConsole";
import { SHARE_KEYS } from "~/lib/military/model";
import { BudgetSplitCard } from "./levers/BudgetSplitCard";
import { ManpowerCard } from "./levers/ManpowerCard";
import { ReservesCard } from "./levers/ReservesCard";
import { PostureCard } from "./levers/PostureCard";

/** The Budget and posture tab: the national levers. The free preview shows them read-only. */
export function PolicyPanel({ countryId }: { countryId: string }) {
  const { owner } = useDefenseOverview(countryId);
  const { canEdit } = useCanEdit();
  const levers = useDefenseLevers(countryId);
  const branchLevers = useBranchLevers(countryId);
  const reader = useNationClock();
  const now = useClockNow(reader);

  if (!owner) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading defense policy">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const { policy } = owner;
  // Drafts restart from what is saved whenever the saved policy changes.
  const sharesKey = SHARE_KEYS.map((key) => policy.shares[key].toFixed(4)).join(":");
  const manpowerKey = `${policy.volunteerShare}:${policy.serviceMonths}:${policy.reserveYears}`;

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="space-y-4">
        <BudgetSplitCard
          key={sharesKey}
          overview={owner}
          canEdit={canEdit}
          pending={levers.pending}
          onSave={levers.saveShares}
          onApplyPreset={levers.applyPreset}
        />
        <PostureCard
          key={`${policy.alertLevel}:${policy.alertChangedClockMs}`}
          overview={owner}
          reader={reader}
          nowClockMs={now ?? owner.clockMs}
          canEdit={canEdit}
          pending={levers.pending}
          onDoctrine={levers.setDoctrine}
          onAlert={levers.setAlertLevel}
          onOmPriority={levers.setOmPriority}
          onSurge={levers.setSurge}
        />
      </div>
      <div className="space-y-4">
        <ManpowerCard
          key={manpowerKey}
          overview={owner}
          canEdit={canEdit}
          pending={levers.pending}
          onSave={levers.saveManpower}
        />
        <ReservesCard
          overview={owner}
          canEdit={canEdit}
          pending={branchLevers.pending}
          onMobilise={branchLevers.mobilise}
          onDemobilise={branchLevers.demobilise}
        />
      </div>
    </div>
  );
}
