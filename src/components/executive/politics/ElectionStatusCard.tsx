"use client";

import { WarningTriangle as AlertTriangle } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";

interface ElectionStatusCardProps {
  countryId: string;
  /** Only the country owner can count a due election early. */
  canManage?: boolean;
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

  let headline: string;
  let detail: string | null = null;
  if (!status.hasLegislature) {
    headline = "No legislature configured";
    detail = `Configure the legislature and register at least ${status.minParties} parties to schedule the first election.`;
  } else if (needsParties) {
    headline = "Awaiting parties";
    detail = `${status.activeParties} of ${status.minParties} active parties registered. The first election is scheduled once ${status.minParties} parties exist.`;
  } else if (status.counting) {
    headline = "Votes are being counted";
  } else if (upcoming?.isDue) {
    headline = `${upcoming.name}: polls have closed`;
    detail = `Voting ended ${IxTime.formatIxTime(upcoming.scheduledIxTime)}. Results are counted by the elections job, or count them now.`;
  } else if (upcoming) {
    headline = upcoming.isFirst
      ? `First election scheduled for ${IxTime.formatIxTime(upcoming.scheduledIxTime)}`
      : `Next election: ${IxTime.formatIxTime(upcoming.scheduledIxTime)}`;
    detail = upcoming.isFirst
      ? "Every active party stands. The result seats the legislature, and bills can then go to a vote."
      : null;
  } else {
    headline = "No election scheduled";
    detail = "The elections job schedules the next one.";
  }

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
