"use client";

import { Bell, BellOff } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Tooltip } from "~/components/ui/tooltip";
import { useCardMute, useMarketActions } from "~/hooks/cards/useMarketActions";

/** Mute every notice about this one card, or hear about it again. It waits until the current setting has loaded. */
export function MuteToggle({ cardId }: { cardId: string }) {
  const { data: muted } = useCardMute(cardId);
  const { setMute } = useMarketActions(cardId);
  return (
    <Tooltip content={muted ? "Notices about this card are muted" : "Mute notices about this card"}>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Mute notices about this card"
        aria-pressed={muted === true}
        disabled={muted === undefined || setMute.isPending}
        onClick={() => setMute.mutate({ cardId, muted: !muted })}
      >
        {muted ? <BellOff aria-hidden /> : <Bell aria-hidden />}
      </Button>
    </Tooltip>
  );
}
