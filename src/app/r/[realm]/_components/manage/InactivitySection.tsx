"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  INACTIVITY_DEFAULT_DAYS,
  INACTIVITY_MAX_DAYS,
  INACTIVITY_MIN_DAYS,
  INACTIVITY_NOTICE_DAYS,
  RECLAIM_WINDOW_DAYS,
} from "~/lib/realms/realm-content";
import { ManageSection } from "./ManageSection";

/**
 * Founder: the realm's inactivity rules (ToS §2.8). The period is theirs to set within the terms' range; the
 * notice, the reclaim window and what happens to a released nation's material are fixed by the terms.
 */
export function InactivitySection({
  slug,
  inactivity,
}: {
  slug: string;
  inactivity: { days: number | null; exclusiveWindow: boolean };
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [enabled, setEnabled] = useState(inactivity.days !== null);
  const [days, setDays] = useState(String(inactivity.days ?? INACTIVITY_DEFAULT_DAYS));
  const [exclusive, setExclusive] = useState(inactivity.exclusiveWindow);
  const save = api.realms.region.updateInactivity.useMutation({
    onSuccess: () => {
      notify.success("Inactivity rules saved");
      void utils.realms.region.invalidate();
    },
    onError: (error) => notify.error("Could not save the inactivity rules", error.message),
  });

  const parsed = Number(days);
  const validDays =
    Number.isInteger(parsed) && parsed >= INACTIVITY_MIN_DAYS && parsed <= INACTIVITY_MAX_DAYS;

  return (
    <ManageSection
      id="inactivity"
      title="Inactive nations"
      description={`A player who has not signed in for this long is warned, and ${INACTIVITY_NOTICE_DAYS} days later their nation is released. Its flag and arms stay hidden for ${RECLAIM_WINDOW_DAYS} days, so the player can claim it back with them.`}
    >
      <div className="flex flex-col gap-4">
        <label className="text-label text-footnote flex items-center gap-2">
          <Checkbox checked={enabled} onCheckedChange={(checked) => setEnabled(checked === true)} />
          Release nations whose players stop playing
        </label>
        {enabled && (
          <div className="flex max-w-xs flex-col gap-2">
            <Label htmlFor="inactivity-days">
              Days without signing in ({INACTIVITY_MIN_DAYS} to {INACTIVITY_MAX_DAYS})
            </Label>
            <Input
              id="inactivity-days"
              type="number"
              min={INACTIVITY_MIN_DAYS}
              max={INACTIVITY_MAX_DAYS}
              step={1}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
        )}
        {enabled && (
          <label className="text-label text-footnote flex items-center gap-2">
            <Checkbox
              checked={exclusive}
              onCheckedChange={(checked) => setExclusive(checked === true)}
            />
            Keep a released nation for its player until the {RECLAIM_WINDOW_DAYS} days are over
          </label>
        )}
        <div>
          <Button
            size="sm"
            disabled={(enabled && !validDays) || save.isPending}
            onClick={() =>
              save.mutate({
                slug,
                inactivityDays: enabled ? parsed : null,
                reclaimWindowExclusive: enabled && exclusive,
              })
            }
          >
            Save inactivity rules
          </Button>
        </div>
      </div>
    </ManageSection>
  );
}
