"use client";
// Staff link an old XenForo forum account to a user (phase 4b: self-service forum linking is retired). Linking
// attributes that account's imported threads and posts at once; unlinking hands them back to the old name.

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useNotify } from "~/hooks/useNotify";

const INPUT_CLASS = "rounded-control-sm md:text-footnote h-(--control-height-sm)";

export interface OldForumAccountTarget {
  id: string;
  forumUserId: number | null;
  forumUsername: string | null;
}

interface OldForumAccountDialogProps {
  /** The user being edited; null closes the dialog. */
  user: OldForumAccountTarget | null;
  onClose: () => void;
  onChanged: () => void;
}

/** A positive XenForo user id typed in the form, or null. */
function parseForumId(value: string): number | null {
  const id = Number(value.trim());
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function OldForumAccountDialog({ user, onClose, onChanged }: OldForumAccountDialogProps) {
  const notify = useNotify();
  const [forumId, setForumId] = useState("");
  const [forumName, setForumName] = useState("");
  const done = (message: string) => {
    notify.success("Success", message);
    setForumId("");
    setForumName("");
    onChanged();
    onClose();
  };
  const link = api.admin.linkUserForum.useMutation({
    onSuccess: (res) =>
      done(
        `Linked as ${res.username}: ${res.relinked.posts} posts and ${res.relinked.threads} threads attributed`
      ),
    onError: (err) => notify.error("Error", err.message || "Failed to link the old forum account"),
  });
  const unlink = api.admin.unlinkUserForum.useMutation({
    onSuccess: () => done("Old forum account unlinked"),
    onError: (err) =>
      notify.error("Error", err.message || "Failed to unlink the old forum account"),
  });
  const id = parseForumId(forumId);

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Old forum account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-label-secondary text-footnote">
            {user?.forumUserId
              ? `Linked to old forum member ${user.forumUserId} (${user.forumUsername ?? "no name"}).`
              : "Not linked to an old forum account."}{" "}
            Enter the old forum member id. The name is taken from the imported posts; type it only
            for a member with no imported posts.
          </p>
          <Input
            placeholder="Old forum member id (e.g. 1234)"
            inputMode="numeric"
            value={forumId}
            onChange={(e) => setForumId(e.target.value)}
            className={INPUT_CLASS}
          />
          <Input
            placeholder="Old forum name (optional)"
            value={forumName}
            onChange={(e) => setForumName(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <DialogFooter>
          {user?.forumUserId ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={unlink.isPending}
              onClick={() => user && unlink.mutate({ userId: user.id })}
            >
              Unlink
            </Button>
          ) : null}
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!user || id === null || link.isPending}
            onClick={() =>
              user &&
              id !== null &&
              link.mutate({
                userId: user.id,
                xenforoUserId: id,
                forumUsername: forumName.trim() || undefined,
              })
            }
          >
            Link and attribute posts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
