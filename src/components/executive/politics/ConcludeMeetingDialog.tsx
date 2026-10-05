"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { useNotify } from "~/hooks/useNotify";

type Decision = "" | "approved" | "rejected" | "deferred";

const DECISION_OPTIONS: { value: Decision; label: string }[] = [
  { value: "", label: "No decision" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "deferred", label: "Deferred" },
];

interface AgendaItem {
  id: string;
  title: string;
}

interface ConcludeMeetingDialogProps {
  meeting: { id: string; title: string; agendaItems: AgendaItem[] };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConcluded?: () => void;
}

/** Record a meeting's outcome and its per-agenda-item decisions, then close it. */
export function ConcludeMeetingDialog({
  meeting,
  open,
  onOpenChange,
  onConcluded,
}: ConcludeMeetingDialogProps) {
  const notify = useNotify();
  const [outcome, setOutcome] = useState("");
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const conclude = api.meetings.concludeMeeting.useMutation({
    onSuccess: () => {
      notify.success("Meeting concluded", `Decisions from "${meeting.title}" are on record`);
      setOutcome("");
      setDecisions({});
      setNotes({});
      onOpenChange(false);
      onConcluded?.();
    },
    onError: (error) => notify.error("Could not conclude the meeting", error.message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!outcome.trim()) return;
    conclude.mutate({
      meetingId: meeting.id,
      outcome: outcome.trim(),
      decisions: meeting.agendaItems.flatMap((item) => {
        const decision = decisions[item.id];
        if (!decision) return [];
        const note = notes[item.id]?.trim();
        return [{ agendaItemId: item.id, decision, ...(note ? { notes: note } : {}) }];
      }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conclude meeting</DialogTitle>
          <DialogDescription>
            Record what &ldquo;{meeting.title}&rdquo; decided. The meeting is then closed.
          </DialogDescription>
        </DialogHeader>

        <form id="conclude-meeting-form" onSubmit={submit} className="space-y-4">
          {meeting.agendaItems.length > 0 && (
            <div className="space-y-3">
              <p className="text-headline">Agenda</p>
              {meeting.agendaItems.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-body min-w-0 truncate">{item.title}</span>
                    <OptionSelect
                      aria-label={`Decision on ${item.title}`}
                      value={decisions[item.id] ?? ""}
                      onValueChange={(v) => setDecisions((prev) => ({ ...prev, [item.id]: v }))}
                      options={DECISION_OPTIONS}
                      size="sm"
                      className="w-36 shrink-0"
                    />
                  </div>
                  {decisions[item.id] && (
                    <Input
                      aria-label={`Notes on ${item.title}`}
                      value={notes[item.id] ?? ""}
                      maxLength={1000}
                      placeholder="What was decided (optional)"
                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="meeting-outcome">Outcome</Label>
            <Textarea
              id="meeting-outcome"
              value={outcome}
              maxLength={2000}
              rows={3}
              placeholder="Summary of the meeting"
              onChange={(e) => setOutcome(e.target.value)}
              required
            />
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={conclude.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="conclude-meeting-form"
            disabled={!outcome.trim() || conclude.isPending}
          >
            {conclude.isPending ? "Concluding" : "Conclude meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
