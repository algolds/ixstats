"use client";

import { Bell, BellOff } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useCardMute, useMarketActions } from "~/hooks/cards/useMarketActions";

/** Mute every notice about this one card, or hear about it again. It waits until the current setting has loaded. */
export function MuteToggle({ cardId }: { cardId: string }) {
  const { data: muted } = useCardMute(cardId);
  const { setMute } = useMarketActions(cardId);
  const label = muted ? "Unmute notices about this card" : "Mute notices about this card";
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={label}
      disabled={muted === undefined || setMute.isPending}
      onClick={() => setMute.mutate({ cardId, muted: !muted })}
    >
      {muted ? <BellOff aria-hidden /> : <Bell aria-hidden />}
    </Button>
  );
}
