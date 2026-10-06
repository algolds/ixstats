"use client";

import React, { useState } from "react";
import { Tournament as Swords } from "iconoir-react";
import { api } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { AssetManager } from "../AssetManager";

/** Assets belong to a branch: pick one, then manage its equipment. */
export function ArsenalPanel({ countryId }: { countryId: string }) {
  const utils = api.useUtils();
  const { data: branches, isLoading } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!branches || branches.length === 0) {
    return (
      <Card>
        <EmptyState
          compact
          icon={<Swords />}
          title="No branches to equip"
          message="Create a branch under Branches and readiness, then add its aircraft, ships and vehicles here."
        />
      </Card>
    );
  }

  const branch = branches.find((b) => b.id === selectedId) ?? branches[0]!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="arsenal-branch">Branch</Label>
        <Select value={branch.id} onValueChange={setSelectedId}>
          <SelectTrigger id="arsenal-branch" className="h-8 w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {branches.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <AssetManager
        key={branch.id}
        countryId={countryId}
        branchId={branch.id}
        branchType={branch.branchType}
        assets={branch.assets}
        onRefetch={() => void utils.security.getMilitaryBranches.invalidate({ countryId })}
      />
    </div>
  );
}
