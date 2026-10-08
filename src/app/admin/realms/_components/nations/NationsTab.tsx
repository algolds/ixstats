"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { NationDefaultsPanel } from "./NationDefaultsPanel";

/**
 * /admin/realms "Nations": pick a realm, then its nation growth defaults by economic tier and applying them to
 * its unclaimed nations. IxWorld is not listed: its nations keep their curated roster values.
 */
export function NationsTab() {
  const { data: realms, isLoading } = api.realms.adminListRealms.useQuery();
  const [realmId, setRealmId] = useState<string | null>(null);
  const choices = (realms ?? []).filter((realm) => realm.id !== DEFAULT_REALM_ID);
  const chosen = realmId ?? choices[0]?.id ?? null;

  if (isLoading) return <p className="text-label-secondary text-body">Loading realms…</p>;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex max-w-sm flex-col gap-1">
        <Label htmlFor="nation-defaults-realm">Realm</Label>
        <Select value={chosen ?? undefined} onValueChange={setRealmId}>
          <SelectTrigger id="nation-defaults-realm">
            <SelectValue placeholder="Choose a realm" />
          </SelectTrigger>
          <SelectContent>
            {choices.map((realm) => (
              <SelectItem key={realm.id} value={realm.id}>
                {realm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {chosen ? (
        <NationDefaultsPanel key={chosen} realmId={chosen} />
      ) : (
        <p className="text-label-secondary text-body">Create a realm first.</p>
      )}
    </div>
  );
}
