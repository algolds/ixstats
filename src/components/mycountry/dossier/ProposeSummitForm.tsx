"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { useClockNow, useViewerNationClock } from "~/hooks/useNationClock";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Textarea } from "~/components/ui/textarea";
import { formatClockDate } from "~/lib/realms/nation-time";
import {
  SUMMIT_AGENDA_MAX,
  SUMMIT_WHEN,
  SUMMIT_WHEN_KEYS,
  summitDate,
  type SummitWhen,
} from "~/lib/diplomacy/summits";

const WHEN_OPTIONS = SUMMIT_WHEN_KEYS.map((value) => ({ value, label: SUMMIT_WHEN[value].label }));

/**
 * Propose a summit in place, where the Summit action was pressed: when (on the proposer's realm clock, with the
 * date it lands on) and an optional agenda. The other nation answers in its diplomacy inbox.
 */
export function ProposeSummitForm({
  targetCountryId,
  targetCountryName,
  onDone,
}: {
  targetCountryId: string;
  targetCountryName: string;
  onDone: () => void;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [when, setWhen] = useState<SummitWhen>("month");
  const [agenda, setAgenda] = useState("");
  const reader = useViewerNationClock();
  const now = useClockNow(reader);

  const propose = api.diplomaticPolicies.proposeSummit.useMutation({
    onSuccess: () => {
      notify.success(
        "Summit proposed",
        `${targetCountryName} will answer in their diplomacy inbox.`
      );
      void utils.diplomaticPolicies.getOutgoingForeignPolicyProposals.invalidate();
      onDone();
    },
    onError: (error) => notify.error("Could not propose the summit", error.message),
  });

  return (
    <Card variant="well" padding="md" className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-subhead text-label">Summit with {targetCountryName}</p>
        <SegmentedControl
          aria-label="When"
          size="sm"
          fullWidth
          options={WHEN_OPTIONS}
          value={when}
          onValueChange={setWhen}
        />
        <p className="text-footnote text-label-secondary">
          On {formatClockDate(now === null ? null : summitDate(now, when), reader)}
        </p>
      </div>
      <Textarea
        aria-label="Agenda (optional)"
        placeholder="Agenda (optional)"
        value={agenda}
        maxLength={SUMMIT_AGENDA_MAX}
        rows={2}
        onChange={(e) => setAgenda(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={propose.isPending}
          onClick={() =>
            propose.mutate({ targetId: targetCountryId, when, agenda: agenda.trim() || undefined })
          }
        >
          {propose.isPending ? "Proposing…" : "Propose summit"}
        </Button>
      </div>
    </Card>
  );
}
