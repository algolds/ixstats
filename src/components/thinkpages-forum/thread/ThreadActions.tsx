"use client";

import { useId, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotify } from "~/hooks/useNotify";
import { api, type RouterOutputs } from "~/trpc/react";
import { NoteDialog } from "../mod/NoteDialog";
import { FormError } from "../ReasonField";
import { ReportDialog } from "../ReportDialog";
import { StashThreadButton } from "../StashThreadButton";
import type { ThreadData } from "./types";

type Flag = "locked" | "pinned" | "hidden" | "archived";
type Destination = NonNullable<
  RouterOutputs["thinkpagesForum"]["thread"]["moderatorTools"]
>["categories"][number];

/** Each flag's button: the label to set it and to clear it. */
const FLAGS: ReadonlyArray<{ flag: Flag; on: string; off: string }> = [
  { flag: "locked", on: "Lock", off: "Unlock" },
  { flag: "pinned", on: "Pin", off: "Unpin" },
  { flag: "hidden", on: "Hide", off: "Unhide" },
  { flag: "archived", on: "Archive", off: "Unarchive" },
];

/** A flag change awaiting its confirmation: the button's label and the value it sets. */
interface Confirmation {
  flag: Flag;
  label: string;
  value: boolean;
}

/** The flags that change what members see: setting or clearing them is confirmed, with a note for the log. */
const CONFIRMED: Readonly<Partial<Record<Flag, { on: string; off: string }>>> = {
  hidden: {
    on: "Members no longer see it. Moderators still do, marked Hidden.",
    off: "Members see it again.",
  },
  archived: {
    on: "No one can reply to it. Members can still read it.",
    off: "Members can reply to it again.",
  },
};

interface ModeratorBarProps {
  thread: { id: string } & Record<Flag, boolean>;
  /** Categories the thread may move to (same audience, moderated by the viewer). */
  categories: readonly Destination[];
  /** Refreshes the thread and the listings whose counts follow it. */
  refresh: () => Promise<void>;
}

/** A moderator's thread actions: lock, pin, hide, archive (each a toggle) and move. */
function ModeratorBar({ thread, categories, refresh }: ModeratorBarProps) {
  const notify = useNotify();
  const moveLabelId = useId();
  const [moving, setMoving] = useState(false);
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirmation | null>(null);
  const flagMutation = api.thinkpagesForumMod.setThreadFlag.useMutation();
  const moveMutation = api.thinkpagesForumMod.moveThread.useMutation();
  const pending = flagMutation.isPending || moveMutation.isPending;

  const toggle = (flag: Flag, label: string) => {
    flagMutation
      .mutateAsync({ threadId: thread.id, flag, value: !thread[flag] })
      // A failed refresh is not a failed action: only the mutation's refusal is reported.
      .then(
        () => void refresh(),
        (e: Error) => notify.error(`Could not ${label.toLowerCase()} the thread`, e.message)
      );
  };

  // The dialog shows a refusal itself; a failed refresh is not one, so it is not awaited.
  const confirmFlag =
    ({ flag, value }: Confirmation) =>
    (note: string | undefined) =>
      flagMutation
        .mutateAsync({ threadId: thread.id, flag, value, ...(note ? { note } : {}) })
        .then(() => void refresh());

  const move = () => {
    const destination = categories.find((c) => c.key === to);
    if (!destination) return;
    setError(null);
    const place = destination.realm ? { realm: destination.realm.slug } : {};
    moveMutation.mutateAsync({ threadId: thread.id, to: { key: destination.key, ...place } }).then(
      () => {
        setMoving(false);
        notify.success("Thread moved", `It is now in ${destination.name}.`);
        void refresh();
      },
      (e: Error) => setError(e.message || "Could not move the thread.")
    );
  };

  return (
    <div role="group" aria-label="Moderate thread" className="flex flex-wrap gap-2">
      {FLAGS.map(({ flag, on, off }) => {
        const label = thread[flag] ? off : on;
        return (
          <Button
            key={flag}
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              CONFIRMED[flag]
                ? setConfirming({ flag, label, value: !thread[flag] })
                : toggle(flag, label)
            }
          >
            {label}
          </Button>
        );
      })}
      {categories.length > 0 ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => {
            // Start from the current list: a move changes it (the old home joins, the new one leaves).
            setTo(categories[0]?.key ?? "");
            setMoving(true);
          }}
        >
          Move
        </Button>
      ) : null}

      {confirming ? (
        <NoteDialog
          title={`${confirming.label} this thread`}
          description={CONFIRMED[confirming.flag]?.[confirming.value ? "on" : "off"] ?? ""}
          confirmLabel={`${confirming.label} thread`}
          destructive={confirming.value}
          onConfirm={confirmFlag(confirming)}
          onOpenChange={(next) => {
            if (!next) setConfirming(null);
          }}
        />
      ) : null}

      <AlertDialog
        open={moving}
        onOpenChange={(next) => {
          setMoving(next);
          if (!next) setError(null);
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Move this thread</AlertDialogTitle>
            <AlertDialogDescription>
              It keeps its posts, and links to it keep working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label id={moveLabelId}>Category</Label>
            <Select value={to} onValueChange={setTo} disabled={pending}>
              <SelectTrigger aria-labelledby={moveLabelId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <FormError message={error} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button onClick={move} disabled={pending || !to}>
              Move thread
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ThreadActionsProps {
  data: ThreadData;
  /** The viewer is signed in: they can stash the thread. */
  signedIn: boolean;
  /** Refreshes the thread and the listings whose counts follow it. */
  refresh: () => Promise<void>;
}

/** The thread's header actions: "In character", the moderator bar, Stash, and Report for a member. */
export function ThreadActions({ data, signedIn, refresh }: ThreadActionsProps) {
  const { thread } = data;
  // A site admin's thread is site admins' to lock, pin, hide, archive or move.
  const moderating = data.canModerate && data.moderable;
  return (
    <>
      {data.style === "ic" ? <Badge variant="outline">In character</Badge> : null}
      {moderating ? (
        <ModeratorBar
          thread={thread}
          categories={data.moderatorTools?.categories ?? []}
          refresh={refresh}
        />
      ) : null}
      {signedIn ? <StashThreadButton threadId={thread.id} /> : null}
      {signedIn && !data.canModerate && !data.viewerIsAuthor ? (
        <ReportDialog targetType="thread" targetId={thread.id} label="Report thread" />
      ) : null}
    </>
  );
}
