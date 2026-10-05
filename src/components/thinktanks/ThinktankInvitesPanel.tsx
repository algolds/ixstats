"use client";
// The invitee side of ThinkTank invites (SL-13): pending invites with accept/decline, and joining
// a group with an invite code a manager shared.

import React, { useState } from "react";
import { Check, Xmark, Mail } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { soundEffects } from "~/lib/sound/cuelume";

export function ThinktankInvitesPanel({ onJoined }: { onJoined: (groupId: string) => void }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [code, setCode] = useState("");
  const { data: invites = [] } = api.thinkpages.getMyThinktankInvites.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const refresh = () => {
    void utils.thinkpages.getMyThinktankInvites.invalidate();
    void utils.thinkpages.getThinktanks.invalidate();
  };
  const onError = (err: { message: string }) => {
    soundEffects.error();
    notify.error(err.message);
  };

  const accept = api.thinkpages.acceptThinktankInvite.useMutation({
    onSuccess: (_res, { inviteId }) => {
      soundEffects.bloom();
      refresh();
      const groupId = invites.find((i) => i.id === inviteId)?.group.id;
      if (groupId) onJoined(groupId);
    },
    onError,
  });
  const decline = api.thinkpages.declineThinktankInvite.useMutation({
    onSuccess: refresh,
    onError,
  });
  const joinByCode = api.thinkpages.joinThinktankByCode.useMutation({
    onSuccess: (res) => {
      soundEffects.bloom();
      setCode("");
      refresh();
      onJoined(res.groupId);
    },
    onError,
  });

  const busy = accept.isPending || decline.isPending;

  return (
    <div className="space-y-2">
      {invites.length > 0 && (
        <div className="space-y-1">
          <p className="text-footnote text-label-secondary flex items-center gap-1 px-1">
            <Mail className="size-3.5" aria-hidden="true" /> Invitations ({invites.length})
          </p>
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="border-separator rounded-row flex items-center gap-2 border p-2"
            >
              <Avatar className="border-separator rounded-control size-8 shrink-0 border">
                {invite.group.avatar ? (
                  <AvatarImage src={invite.group.avatar} alt={invite.group.name} />
                ) : null}
                <AvatarFallback className="bg-tint-fill text-caption text-tint rounded-control">
                  {invite.group.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-subhead text-label truncate">{invite.group.name}</p>
                <p className="text-footnote text-label-secondary truncate">
                  From {invite.invitedByName}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                aria-label={`Accept invitation to ${invite.group.name}`}
                disabled={busy}
                onClick={() => accept.mutate({ inviteId: invite.id })}
              >
                <Check aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Decline invitation to ${invite.group.name}`}
                disabled={busy}
                onClick={() => decline.mutate({ inviteId: invite.id })}
              >
                <Xmark aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = code.trim();
          if (trimmed) joinByCode.mutate({ code: trimmed });
        }}
      >
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Invite code"
          aria-label="Invite code"
          maxLength={32}
          className="h-8 font-mono text-xs uppercase"
        />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={code.trim().length < 4 || joinByCode.isPending}
        >
          Join
        </Button>
      </form>
    </div>
  );
}
