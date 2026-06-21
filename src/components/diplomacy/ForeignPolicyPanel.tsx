"use client";

import { useState, useMemo } from "react";
import { Scale, Ban, Plus, ArrowRightLeft } from "lucide-react";
import { Button } from "~/components/ui/button";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { ActivePoliciesList } from "./foreign-policy/ActivePoliciesList";
import { TradeImpactChart } from "./foreign-policy/TradeImpactChart";
import { ForeignPolicyCreatorSheet } from "./ForeignPolicyCreatorSheet";
import { api } from "~/trpc/react";

interface ForeignPolicyPanelProps {
  countryId: string;
  /** When set, scroll to + highlight this policy in the active-policies list. */
  focusId?: string | null;
}

export function ForeignPolicyPanel({ countryId, focusId }: ForeignPolicyPanelProps) {
  const [showCreator, setShowCreator] = useState(false);
  const utils = api.useUtils();

  const { data: policies } = api.diplomaticPolicies.getActiveForeignPolicies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: relations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const stats = useMemo(() => {
    const active =
      policies?.filter((p: any) => p.status === "ACTIVE" || p.status === "active").length ?? 0;
    const proposed =
      policies?.filter((p: any) => p.status === "PROPOSED" || p.status === "proposed").length ?? 0;
    const tradePartners = relations ? new Set(relations.map((r) => r.targetCountryId)).size : 0;
    return { active, proposed, tradePartners };
  }, [policies, relations]);

  const handlePolicyCreated = () => {
    void utils.diplomaticPolicies.getActiveForeignPolicies.invalidate({ countryId });
  };

  return (
    <div className="space-y-4">
      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="glass-hierarchy-child rounded-lg p-2.5">
          <div className="flex items-center gap-1.5">
            <Ban className="h-3.5 w-3.5 shrink-0 text-red-600" />
            <span className="text-muted-foreground text-xs font-medium">Active Policies</span>
          </div>
          <div className="mt-0.5 text-lg font-bold">{stats.active}</div>
        </div>
        <div className="glass-hierarchy-child rounded-lg p-2.5">
          <div className="flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span className="text-muted-foreground text-xs font-medium">Proposed</span>
          </div>
          <div className="mt-0.5 text-lg font-bold">{stats.proposed}</div>
        </div>
        <div className="glass-hierarchy-child rounded-lg p-2.5">
          <div className="flex items-center gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-cyan-600" />
            <span className="text-muted-foreground text-xs font-medium">Trade Partners</span>
          </div>
          <div className="mt-0.5 text-lg font-bold">{stats.tradePartners}</div>
        </div>
      </div>

      {/* Header + propose button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-cyan-600" />
          <h3 className="text-sm font-semibold">Foreign Policy</h3>
          <SectionHelpIcon
            title="Foreign Policy"
            content="Manage your nation's foreign policy positions and trade agreements. Propose new policies to shape your international relations, monitor active policies, and track bilateral trade impacts."
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowCreator(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Propose Policy
        </Button>
      </div>

      {/* Active policies */}
      <ActivePoliciesList countryId={countryId} focusId={focusId} />

      {/* Bilateral trade viewer */}
      <TradeImpactChart countryId={countryId} />

      {/* Creator Sheet */}
      <ForeignPolicyCreatorSheet
        countryId={countryId}
        open={showCreator}
        onOpenChange={setShowCreator}
        onCreated={handlePolicyCreated}
      />
    </div>
  );
}
