"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SourceSyncPanel } from "./SourceSyncPanel";

/** /admin/realms "Source sync": pick a realm, then its source sync settings, runs and history. */
export function SourceSyncTab() {
  const { data: realms, isLoading } = api.realms.adminListRealms.useQuery();
  const [slug, setSlug] = useState<string | null>(null);
  const chosen = slug ?? realms?.find((r) => r.id !== "default")?.slug ?? null;

  if (isLoading) return <p className="text-label-secondary text-body">Loading realms…</p>;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-sm flex-col gap-1">
        <Label htmlFor="source-sync-realm">Realm</Label>
        <Select value={chosen ?? undefined} onValueChange={setSlug}>
          <SelectTrigger id="source-sync-realm">
            <SelectValue placeholder="Choose a realm" />
          </SelectTrigger>
          <SelectContent>
            {(realms ?? []).map((realm) => (
              <SelectItem key={realm.id} value={realm.slug}>
                {realm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {chosen ? (
        <SourceSyncPanel key={chosen} slug={chosen} />
      ) : (
        <p className="text-label-secondary text-body">Create a realm first.</p>
      )}
    </div>
  );
}
