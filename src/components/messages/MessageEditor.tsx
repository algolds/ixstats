"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { stripTags } from "~/lib/messages/format";

/** Edits a sent message in place: Enter saves, Escape cancels. */
export function MessageEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(() => stripTags(initial));
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const save = () => {
    if (content.trim() && content !== initial) onSave(content.trim());
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      save();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="bg-surface border-tint rounded-card w-full min-w-[min(280px,100%)] border p-3">
      <textarea
        ref={inputRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={2}
        aria-label="Edit message"
        className="text-body text-label w-full resize-none bg-transparent outline-none"
      />
      <div className="border-separator mt-2 flex items-center justify-end gap-2 border-t pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" onClick={save}>
          Save
        </Button>
      </div>
    </div>
  );
}
