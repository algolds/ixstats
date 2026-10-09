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
import { FormError } from "./ReasonField";

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

interface ThreadModeratorBarProps {
  thread: { id: string } & Record<Flag, boolean>;
  /** Categories the thread may move to (same audience, moderated by the viewer). */
  categories: readonly Destination[];
  /** Refreshes the thread and the listings whose counts follow it. */
  refresh: () => Promise<void>;
}

/** A moderator's thread actions under its header: lock, pin, hide, archive (each a toggle) and move. */
export function ThreadModeratorBar({ thread, categories, refresh }: ThreadModeratorBarProps) {
  const notify = useNotify();
  const moveLabelId = useId();
  const [moving, setMoving] = useState(false);
  const [to, setTo] = useState(categories[0]?.key ?? "");
  const [error, setError] = useState<string | null>(null);
  const flagMutation = api.thinkpagesForumMod.setThreadFlag.useMutation();
  const moveMutation = api.thinkpagesForumMod.moveThread.useMutation();
  const pending = flagMutation.isPending || moveMutation.isPending;

  const toggle = (flag: Flag, label: string) => {
    flagMutation
      .mutateAsync({ threadId: thread.id, flag, value: !thread[flag] })
      .then(refresh)
      .catch((e: Error) => notify.error(`Could not ${label.toLowerCase()} the thread`, e.message));
  };

  const move = () => {
    const destination = categories.find((c) => c.key === to);
    if (!destination) return;
    setError(null);
    const place = destination.realm ? { realm: destination.realm.slug } : {};
    moveMutation
      .mutateAsync({ threadId: thread.id, to: { key: destination.key, ...place } })
      .then(() => {
        setMoving(false);
        notify.success("Thread moved", `It is now in ${destination.name}.`);
        return refresh();
      })
      .catch((e: Error) => setError(e.message || "Could not move the thread."));
  };

  return (
    <div role="toolbar" aria-label="Moderate thread" className="flex flex-wrap gap-2">
      {FLAGS.map(({ flag, on, off }) => {
        const label = thread[flag] ? off : on;
        return (
          <Button
            key={flag}
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => toggle(flag, label)}
          >
            {label}
          </Button>
        );
      })}
      {categories.length > 0 ? (
        <Button variant="secondary" size="sm" disabled={pending} onClick={() => setMoving(true)}>
          Move
        </Button>
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
