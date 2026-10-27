"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { ForumComposer } from "../ForumComposer";
import type { ModeratorTools } from "../ModeratorMenu";
import type { BoardMessageData } from "./types";

interface MessageEditorProps {
  message: BoardMessageData;
  /** A moderator's edit: it needs a note for the log and goes through the moderator's save. */
  asModerator: boolean;
  tools: ModeratorTools | null;
  onSaved: () => void;
  onCancel: () => void;
}

/** A board message's editor in place: the author's edit within the window, or a moderator's edit with a note. */
export function MessageEditor({
  message,
  asModerator,
  tools,
  onSaved,
  onCancel,
}: MessageEditorProps) {
  const [note, setNote] = useState("");
  const { mutateAsync: edit } = api.thinkpagesForum.editBoardMessage.useMutation();

  const save = async (html: string) => {
    if (asModerator && tools) {
      if (!note.trim()) throw new Error("Add a note for the moderation log.");
      await tools.saveEdit(message.id, html, note.trim());
    } else {
      await edit({ postId: message.id, html });
    }
    onSaved();
  };

  return (
    <section
      aria-label={asModerator ? "Edit message as moderator" : "Edit message"}
      className="min-w-0 flex-1 space-y-2"
    >
      {asModerator ? (
        <Input
          aria-label="Note for the moderation log"
          placeholder="Why you are editing this message (required)"
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
        />
      ) : null}
      <ForumComposer
        icAllowed={false}
        initialHtml={message.contentHtml}
        submitLabel="Save"
        onSubmit={({ html }) => save(html)}
      />
      <Button variant="ghost" size="sm" className="pointer-coarse:min-h-11" onClick={onCancel}>
        Cancel
      </Button>
    </section>
  );
}
