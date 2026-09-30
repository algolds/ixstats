"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

const FORUM_ACCOUNT_DETAILS_URL = "https://forum.ixwiki.com/account/account-details";

interface ForumAccountVerifyProps {
  /** Called once the forum account is verified and linked. */
  onLinked?: () => void;
  onCancel?: () => void;
}

/**
 * Link a forum account with proof (WK-1): get a code, put it in the Location or About field of
 * your forum profile, then press Verify.
 */
export function ForumAccountVerify({ onLinked, onCancel }: ForumAccountVerifyProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState<{
    code: string;
    forumUsername: string;
    expiresAt: Date;
  } | null>(null);

  const start = api.ixnayid.startForumVerification.useMutation({
    onSuccess: (res) =>
      setPending({ code: res.code, forumUsername: res.forumUsername, expiresAt: res.expiresAt }),
    onError: (err) => notify.error(err.message || "Failed to start forum verification"),
  });

  const confirm = api.ixnayid.confirmForumVerification.useMutation({
    onSuccess: (res) => {
      notify.success(`Forum account ${res.forumUsername} linked`);
      setPending(null);
      setUsername("");
      void utils.ixnayid.getStatus.invalidate();
      onLinked?.();
    },
    onError: (err) => notify.error(err.message || "Failed to verify forum account"),
  });

  if (pending) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-xs leading-relaxed">
          Signed in to the forum as <strong>{pending.forumUsername}</strong>, paste{" "}
          <code className="bg-muted rounded px-1 font-mono select-all">{pending.code}</code> into
          the <strong>Location</strong> or <strong>About you</strong> field of your{" "}
          <a
            href={FORUM_ACCOUNT_DETAILS_URL}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            forum account details
          </a>
          , save, then press Verify. The code works until{" "}
          {new Date(pending.expiresAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          . You can remove it once the account is linked.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={confirm.isPending}
            onClick={() => confirm.mutate({ forumUsername: pending.forumUsername })}
          >
            {confirm.isPending ? "Checking…" : "Verify"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={start.isPending}
            onClick={() => start.mutate({ forumUsername: pending.forumUsername })}
          >
            New code
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
            Back
          </Button>
        </div>
      </div>
    );
  }

  const submit = () => {
    if (username.trim()) start.mutate({ forumUsername: username.trim() });
  };

  return (
    <div className="flex gap-2">
      <Input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Forum username"
        className="h-8 flex-1 text-xs"
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />
      <Button size="sm" disabled={!username.trim() || start.isPending} onClick={submit}>
        {start.isPending ? "Looking up…" : "Get code"}
      </Button>
      {onCancel && (
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
}
