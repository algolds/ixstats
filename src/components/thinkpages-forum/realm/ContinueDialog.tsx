"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useNotify } from "~/hooks/useNotify";
import { REALM_CATEGORIES, REALM_HUB_KEY } from "~/lib/thinkpages-forum/categories";
import { api } from "~/trpc/react";
import { FormError } from "../ReasonField";
import type { BoardMessageData } from "./types";

/** The thread title bounds the server enforces (writes.ts). */
const TITLE_MIN = 3;
const TITLE_MAX = 200;
const IC_BOARDS = REALM_CATEGORIES.filter((category) => category.icAllowed);
const FIRST_IC_BOARD = IC_BOARDS[0]?.key ?? REALM_HUB_KEY;

interface ContinueDialogProps {
  message: BoardMessageData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The message moved: refresh the board. */
  onDone: () => void;
}

/**
 * Turns a board message into a new thread: asks for the thread's title and where it starts. The Hub takes a player's
 * message; a persona's message, which is in character, starts in one of the realm's in-character boards.
 */
export function ContinueDialog({ message, open, onOpenChange, onDone }: ContinueDialogProps) {
  const notify = useNotify();
  const { mutateAsync: continueInThread, isPending } =
    api.thinkpagesForum.continueInThread.useMutation();
  const inCharacter = message.author.persona;
  const [title, setTitle] = useState("");
  const [boardKey, setBoardKey] = useState(FIRST_IC_BOARD);
  const [error, setError] = useState<string | null>(null);
  const trimmed = title.trim();

  const send = () => {
    setError(null);
    continueInThread({
      postId: message.id,
      title: trimmed,
      ...(inCharacter ? { categoryKey: boardKey } : {}),
    }).then(
      () => {
        notify.success("Continued in a thread");
        onOpenChange(false);
        setTitle("");
        onDone();
      },
      (e: Error) => setError(e.message || "Could not continue this message in a thread.")
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Continue in a thread</DialogTitle>
          <DialogDescription>
            The message moves into a new thread as its first post. The board keeps a link to it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="continue-title">Thread title</Label>
          <Input
            id="continue-title"
            value={title}
            maxLength={TITLE_MAX}
            disabled={isPending}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        {inCharacter ? (
          <div className="space-y-2">
            <Label id="continue-board-label">Where it starts</Label>
            <Select value={boardKey} onValueChange={setBoardKey} disabled={isPending}>
              <SelectTrigger aria-labelledby="continue-board-label">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IC_BOARDS.map((board) => (
                  <SelectItem key={board.key} value={board.key}>
                    {board.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-footnote text-label-secondary">It starts in the realm Hub.</p>
        )}
        <FormError message={error} />
        <DialogFooter>
          <Button onClick={send} disabled={isPending || trimmed.length < TITLE_MIN}>
            Continue in a thread
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
