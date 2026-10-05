"use client";

import { useState } from "react";
import { format } from "date-fns";
import { api, type RouterOutputs } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { ConcludeMeetingDialog } from "./ConcludeMeetingDialog";

type Meeting = RouterOutputs["meetings"]["getMeetings"][number];

/** Meetings shown per list; older ones stay on record but off the panel. */
const MEETING_LIMIT = 10;

const DECISION_LABEL: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  deferred: "Deferred",
};

interface CabinetMeetingsPanelProps {
  countryId: string;
  /** Only the country owner can conclude meetings. */
  canManage?: boolean;
}

/**
 * The country's cabinet meetings: open ones can be concluded with their decisions, concluded
 * ones show the outcome and what each agenda item decided.
 */
export function CabinetMeetingsPanel({ countryId, canManage = true }: CabinetMeetingsPanelProps) {
  const [concluding, setConcluding] = useState<Meeting | null>(null);
  const {
    data: meetings,
    isLoading,
    refetch,
  } = api.meetings.getMeetings.useQuery({ countryId }, { enabled: !!countryId });

  const hosted = (meetings ?? []).filter((m) => m.countryId === countryId);
  const open = hosted.filter((m) => m.status !== "completed" && m.status !== "cancelled");
  const concluded = hosted.filter((m) => m.status === "completed").slice(0, MEETING_LIMIT);

  return (
    <Card className="flex flex-col gap-6 py-6">
      <CardHeader className="pb-0">
        <CardTitle className="text-body">Cabinet meetings</CardTitle>
        <CardDescription className="text-body">
          Conclude a meeting to put its decisions on record.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {isLoading ? (
          <Skeleton className="rounded-row h-16" />
        ) : hosted.length === 0 ? (
          <p className="text-label-secondary text-footnote">
            No meetings yet. Schedule one from a national issue or the actions menu.
          </p>
        ) : (
          <>
            {open.slice(0, MEETING_LIMIT).map((meeting) => (
              <div
                key={meeting.id}
                className="bg-fill-4 border-separator rounded-row flex items-center justify-between gap-3 border p-3"
              >
                <div className="min-w-0">
                  <p className="text-body truncate font-medium">{meeting.title}</p>
                  <p className="text-label-secondary text-footnote">
                    {format(new Date(meeting.scheduledDate), "d MMM yyyy")} ·{" "}
                    {meeting.agendaItems.length} agenda item
                    {meeting.agendaItems.length === 1 ? "" : "s"}
                  </p>
                </div>
                {canManage && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => setConcluding(meeting)}
                  >
                    Conclude
                  </Button>
                )}
              </div>
            ))}

            {concluded.map((meeting) => (
              <div key={meeting.id} className="border-separator rounded-row space-y-2 border p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-body min-w-0 truncate font-medium">{meeting.title}</p>
                  <Badge variant="secondary" className="shrink-0">
                    Concluded
                  </Badge>
                </div>
                {meeting.notes && (
                  <p className="text-label-secondary text-footnote">{meeting.notes}</p>
                )}
                {meeting.decisions.length > 0 && (
                  <ul className="space-y-1">
                    {meeting.decisions.map((d) => (
                      <li key={d.id} className="text-footnote flex justify-between gap-3">
                        <span className="text-label min-w-0 truncate">{d.title}</span>
                        <span className="text-label-secondary shrink-0">
                          {DECISION_LABEL[d.decisionType] ?? d.decisionType}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </>
        )}
      </CardContent>

      {concluding && (
        <ConcludeMeetingDialog
          meeting={concluding}
          open={!!concluding}
          onOpenChange={(isOpen) => !isOpen && setConcluding(null)}
          onConcluded={() => void refetch()}
        />
      )}
    </Card>
  );
}
