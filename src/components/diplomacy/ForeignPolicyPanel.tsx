"use client";

import { Scale } from "lucide-react";
import { SectionHelpIcon } from "~/components/ui/help-icon";
import { ProposePolicyModal } from "./foreign-policy/ProposePolicyModal";
import { ActivePoliciesList } from "./foreign-policy/ActivePoliciesList";
import { TradeImpactChart } from "./foreign-policy/TradeImpactChart";
import { api } from "~/trpc/react";

interface ForeignPolicyPanelProps {
  countryId: string;
}

export function ForeignPolicyPanel({ countryId }: ForeignPolicyPanelProps) {
  const utils = api.useUtils();

  const handlePolicyCreated = () => {
    void utils.diplomatic.getActiveForeignPolicies.invalidate({ countryId });
  };

  return (
    <div className="space-y-4">
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
        <ProposePolicyModal countryId={countryId} onSuccess={handlePolicyCreated} />
      </div>

      {/* Active policies */}
      <ActivePoliciesList countryId={countryId} />

      {/* Bilateral trade viewer */}
      <TradeImpactChart countryId={countryId} />
    </div>
  );
}
