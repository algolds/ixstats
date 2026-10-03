"use client";

import { WarningTriangle as AlertTriangle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { api, type RouterOutputs } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";

interface ElectionStatusCardProps {
  countryId: string;
  /** Only the country owner can count a due election early. */
  canManage?: boolean;
}

type ElectionStatus = NonNullable<RouterOutputs["elections"]["getElectionStatus"]>;

function describeElection(status: ElectionStatus): { headline: string; detail?: string } {
  const { upcoming, minParties } = status;
  if (!status.hasLegislature) {
    return {
      headline: "No legislature configured",
      detail: `Configure the legislature and register at least ${minParties} parties to schedule the first election.`,
    };
  }
  if (status.activeParties < minParties) {
    return {
      headline: "Awaiting parties",
      detail: `${status.activeParties} of ${minParties} active parties registered. The first election is scheduled once ${minParties} parties exist.`,
    };
  }
  if (status.counting) return { headline: "Votes are being counted" };
  if (!upcoming) {
    return {
      headline: "No election scheduled",
      detail: "The elections job schedules the next one.",
    };
  }
  const when = IxTime.formatIxTime(upcoming.scheduledIxTime);
  if (upcoming.isDue) {
    return {
      headline: `${upcoming.name}: polls have closed`,
      detail: `Voting ended ${when}. Results are counted by the elections job, or count them now.`,
    };
  }
  return upcoming.isFirst
    ? {
        headline: `First election scheduled for ${when}`,
        detail:
          "Every active party stands. The result seats the legislature, and bills can then go to a vote.",
      }
    : { headline: `Next election: ${when}` };
}

/**
 * Where the country stands in the election lifecycle — what setup is missing, when the
 * (first) election falls due on the IxTime clock, the last result and the seat composition.
 * Every number comes from `elections.getElectionStatus`; nothing is estimated.
 */
export function ElectionStatusCard({ countryId, canManage = true }: ElectionStatusCardProps) {
  const utils = api.useUtils();
  const { data: status } = api.elections.getElectionStatus.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const resolveDue = api.elections.resolveDueElection.useMutation({
    onSettled: () => {
      void utils.elections.invalidate();
      void utils.legislation.invalidate();
    },
  });

  if (!status) return null;

  const { upcoming, lastElection } = status;
  const needsParties = status.activeParties < status.minParties;
  const { headline, detail } = describeElection(status);
  const vacant = status.totalSeats - status.seatedSeats;

  return (
    <div className="border-separator rounded-row space-y-3 border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {(upcoming?.isDue || needsParties || !status.hasLegislature) && (
            <AlertTriangle aria-hidden className="text-yellow mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0">
            <h4 className="text-headline">{headline}</h4>
            {detail && <p className="text-label-secondary text-footnote mt-0.5">{detail}</p>}
          </div>
        </div>
        {canManage && upcoming?.isDue && !needsParties && !status.counting && (
          <Button
            size="sm"
            variant="outline"
            disabled={resolveDue.isPending}
            onClick={() => resolveDue.mutate({ countryId })}
          >
            {resolveDue.isPending ? "Counting" : "Count votes"}
          </Button>
        )}
      </div>
      {resolveDue.error && <p className="text-footnote text-red">{resolveDue.error.message}</p>}

      {status.hasLegislature && (
        <p className="text-label-secondary text-footnote">
          Seats: {status.seatedSeats} of {status.totalSeats} held by parties
          {vacant > 0 ? ` · ${vacant} vacant` : ""}
          {status.seatedSeats === 0 ? " · bills cannot pass until the chamber is seated" : ""}
        </p>
      )}

      {lastElection && (
        <div className="space-y-2">
          <p className="text-caption font-semibold">
            {lastElection.name} · {IxTime.formatIxTime(lastElection.scheduledIxTime)}
            {lastElection.turnout != null ? ` · turnout ${lastElection.turnout}%` : ""}
          </p>
          {lastElection.results.map((r) => (
            <div key={r.partyId} className="text-footnote flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: r.color }}
                />
                <span className="truncate">{r.partyName}</span>
              </span>
              <span className="text-label-secondary shrink-0 tabular-nums">
                {r.votePercentage.toFixed(1)}% · {r.seatsWon} seats
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
