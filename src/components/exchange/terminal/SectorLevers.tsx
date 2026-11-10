"use client";

import { useState } from "react";
import { StatsReport } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { SectionTitle } from "./brand";

// ponytail: mirrors DM_MODIFIER_MIN/MAX in lib/exchange/sectors.ts (a server module); the router enforces them
const MIN = -0.5;
const MAX = 2;

/** A realm manager's demand modifier per sector: 0 is neutral, 0.5 lifts a sector's target by half. */
export function SectorLevers({ realmId }: { realmId: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const sectors = api.exchange.getSectors.useQuery({ realmId });
  const set = api.exchange.setSectorDmModifier.useMutation({
    onSuccess: () => {
      notify.success("Sector modifier set", "The next index tick uses it");
      void utils.exchange.invalidate();
    },
    onError: (e) => notify.error("Could not set the modifier", e.message),
  });

  return (
    <Card content="input" padding="lg" className="space-y-3">
      <div>
        <SectionTitle icon={<StatsReport />}>Sector levers</SectionTitle>
        <p className="text-footnote text-label-secondary">
          Steer a sector&apos;s demand in this realm, from {MIN} to {MAX}. 0 is neutral.
        </p>
      </div>
      <ul className="divide-separator divide-y">
        {(sectors.data ?? []).map((s) => {
          const raw = drafts[s.sectorKey] ?? String(s.dmModifier);
          const value = Number(raw);
          const valid = raw !== "" && Number.isFinite(value) && value >= MIN && value <= MAX;
          return (
            <li key={s.sectorKey} className="flex items-center justify-between gap-3 py-2">
              <label htmlFor={`lever-${s.sectorKey}`} className="text-footnote text-label">
                {s.label}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={`lever-${s.sectorKey}`}
                  aria-label={`${s.label} modifier`}
                  type="number"
                  step={0.05}
                  min={MIN}
                  max={MAX}
                  className="w-24"
                  value={raw}
                  onChange={(e) => setDrafts({ ...drafts, [s.sectorKey]: e.target.value })}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  aria-label={`Set ${s.label}`}
                  disabled={!valid || value === s.dmModifier || set.isPending}
                  onClick={() => set.mutate({ realmId, sectorKey: s.sectorKey, value })}
                >
                  Set
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
