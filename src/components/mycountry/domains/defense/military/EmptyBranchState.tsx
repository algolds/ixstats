"use client";
// src/components/defense/military/EmptyBranchState.tsx

import React from "react";
import { Shield, Plus } from "iconoir-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

interface EmptyBranchStateProps {
  onCreateBranch: () => void;
}

/** Shown when no military branches exist yet. */
export const EmptyBranchState = React.memo(function EmptyBranchState({
  onCreateBranch,
}: EmptyBranchStateProps) {
  return (
    <Card className="facet-hierarchy-child">
      <CardContent className="py-8 text-center">
        <Shield className="text-muted-foreground/50 mx-auto mb-3 h-10 w-10" />
        <h3 className="mb-2 text-sm font-semibold">No Military Branches</h3>
        <p className="text-muted-foreground mb-4 text-sm">
          Create your first military branch to start building your armed forces
        </p>
        <Button onClick={onCreateBranch}>
          <Plus className="mr-2 h-4 w-4" />
          Create First Branch
        </Button>
      </CardContent>
    </Card>
  );
});
