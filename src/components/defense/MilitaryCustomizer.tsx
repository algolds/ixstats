// src/components/defense/MilitaryCustomizer.tsx
"use client";

import React from "react";
import { BRANCH_CONFIGS } from "~/lib/military-config";
import { useMilitaryBranches } from "~/hooks/useMilitaryBranches";
import {
  BranchCard,
  BranchDialog,
  BranchHeader,
  EmptyBranchState,
} from "~/components/defense/military";

interface MilitaryCustomizerProps {
  countryId: string;
}

/**
 * Orchestrator for the Military Forces Management panel.
 * Composes the useMilitaryBranches hook with presentational sub-components.
 */
export function MilitaryCustomizer({ countryId }: MilitaryCustomizerProps) {
  const {
    branches,
    refetchBranches,
    createBranch,
    updateBranch,
    showBranchDialog,
    setShowBranchDialog,
    editingBranch,
    expandedBranches,
    toggleBranch,
    handleCreateBranch,
    handleEditBranch,
    handleDeleteBranch,
  } = useMilitaryBranches({ countryId });

  return (
    <div className="space-y-4">
      {/* Header */}
      <BranchHeader onCreateBranch={handleCreateBranch} />

      {/* Branch list or empty state */}
      {branches && branches.length > 0 ? (
        <div className="space-y-4">
          {branches.map((branch) => {
            const config = BRANCH_CONFIGS[branch.branchType as keyof typeof BRANCH_CONFIGS];

            return (
              <BranchCard
                key={branch.id}
                branch={branch}
                config={config}
                isExpanded={expandedBranches.has(branch.id)}
                onToggle={() => toggleBranch(branch.id)}
                onEdit={() => handleEditBranch(branch)}
                onDelete={() => handleDeleteBranch(branch.id)}
                onRefetch={refetchBranches}
              />
            );
          })}
        </div>
      ) : (
        <EmptyBranchState onCreateBranch={handleCreateBranch} />
      )}

      {/* Create / Edit Dialog */}
      <BranchDialog
        open={showBranchDialog}
        onOpenChange={setShowBranchDialog}
        branch={editingBranch}
        countryId={countryId}
        onCreate={(data) => createBranch.mutate({ countryId, branch: data })}
        onUpdate={(id, data) => updateBranch.mutate({ id, branch: data })}
      />
    </div>
  );
}
