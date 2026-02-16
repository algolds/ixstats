"use client";

import { Swords } from "lucide-react";
import { DeploymentWizard } from "./operations/DeploymentWizard";
import { ActiveOperations } from "./operations/ActiveOperations";
import { PvPConflictPanel } from "./operations/PvPConflictPanel";
import { api } from "~/trpc/react";

interface OperationsPanelProps {
  countryId: string;
}

export function OperationsPanel({ countryId }: OperationsPanelProps) {
  const utils = api.useUtils();

  const handleOperationCreated = () => {
    void utils.security.getOperations.invalidate({ countryId });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Swords className="h-4 w-4 text-red-600" />
          <h3 className="text-sm font-semibold">Military Operations</h3>
        </div>
        <DeploymentWizard countryId={countryId} onSuccess={handleOperationCreated} />
      </div>

      {/* Active operations */}
      <ActiveOperations countryId={countryId} />

      {/* PvP / PvNPC conflicts */}
      <PvPConflictPanel countryId={countryId} />
    </div>
  );
}
