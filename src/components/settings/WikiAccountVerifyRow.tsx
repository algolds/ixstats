"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

type Source = "ixwiki" | "iiwiki" | "althistory";
type WikiLinkView = RouterOutputs["ixnayid"]["listWikiLinks"][number];

interface WikiAccountVerifyRowProps {
  source: Source;
  label: string;
  link: WikiLinkView | undefined;
}

export function WikiAccountVerifyRow({ source, label, link }: WikiAccountVerifyRowProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [username, setUsername] = useState("");
  const [code, setCode] = useState<{ token: string; userPageUrl: string } | null>(null);

  const refresh = () => {
    void utils.ixnayid.listWikiLinks.invalidate();
    void utils.ixnayid.getStatus.invalidate();
  };

  const start = api.ixnayid.startWikiVerification.useMutation({
    onSuccess: (res) => {
      setCode({ token: res.token, userPageUrl: res.userPageUrl });
      refresh();
    },
    onError: (err) => notify.error(err.message || `Failed to start ${label} verification`),
  });

  const confirm = api.ixnayid.confirmWikiVerification.useMutation({
    onSuccess: (res) => {
      notify.success(`${label} account ${res.username} verified`);
      setCode(null);
      refresh();
    },
    onError: (err) => notify.error(err.message || `Failed to verify ${label} account`),
  });

  const unlink = api.ixnayid.unlinkWikiAccount.useMutation({
    onSuccess: refresh,
    onError: (err) => notify.error(err.message || `Failed to unlink ${label} account`),
  });

  if (link?.verified) {
    return (
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">
          {label}: <strong>{link.username}</strong> · Verified
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={unlink.isPending}
          onClick={() => unlink.mutate({ source })}
        >
          Unlink
        </Button>
      </div>
    );
  }

  if (link?.pending || code) {
    return (
      <div className="flex flex-col gap-2">
        {code && (
          <p className="text-muted-foreground text-xs">
            Paste{" "}
            <code className="bg-muted rounded px-1 font-mono">{code.token}</code> anywhere on
            your {label} user page and save it while logged in as{" "}
            <strong>{link?.username}</strong>, then press Verify. The code works for 24 hours.{" "}
            <a
              href={code.userPageUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Open your {label} user page
            </a>
            .
          </p>
        )}
        <div className="flex gap-2">
          <Button size="sm" disabled={confirm.isPending} onClick={() => confirm.mutate({ source })}>
            {confirm.isPending ? "Checking…" : "Verify"}
          </Button>
          {!code && link && (
            <Button
              size="sm"
              variant="outline"
              disabled={start.isPending}
              onClick={() => start.mutate({ source, username: link.username })}
            >
              New code
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder={`${label} username`}
        className="h-8 text-xs"
        onKeyDown={(e) => e.key === "Enter" && username.trim() && start.mutate({ source, username: username.trim() })}
      />
      <Button
        size="sm"
        disabled={!username.trim() || start.isPending}
        onClick={() => start.mutate({ source, username: username.trim() })}
      >
        Get code
      </Button>
    </div>
  );
}
