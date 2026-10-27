"use client";

import { User } from "iconoir-react";
import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import { CosmeticChatBadge } from "~/components/vault/CosmeticChatBadge";
import type { PublicCosmetics } from "~/lib/vault/public-cosmetics";

/**
 * A store card's live preview of a cosmetic, worn on a stand-in avatar with the same components that
 * render it once equipped (AvatarGlow, NeonFrameOverlay, CosmeticChatBadge), so what you see in the
 * store is what other players will see.
 */
export function CosmeticStorePreview({ cosmetics }: { cosmetics: PublicCosmetics }) {
  const { avatarGlow, neonFrame, chatBadge } = cosmetics;

  if (neonFrame.enabled) {
    return (
      <div
        aria-hidden
        className="bg-surface-secondary border-separator rounded-card relative flex h-20 w-16 items-center justify-center overflow-hidden border shadow-inner"
      >
        <User className="text-label-tertiary size-7" />
        <NeonFrameOverlay neonFrame={neonFrame} className="rounded-card" />
      </div>
    );
  }

  if (avatarGlow.enabled) {
    return (
      <div aria-hidden className="flex h-20 items-center justify-center">
        <AvatarGlow avatarGlow={avatarGlow} className="bg-surface-secondary size-14">
          <User className="text-label-tertiary size-7" />
        </AvatarGlow>
      </div>
    );
  }

  return (
    <div aria-hidden className="flex h-20 flex-col items-center justify-center gap-2">
      <CosmeticChatBadge badge={chatBadge} className="size-8" />
      <span className="bg-fill-3 border-separator text-caption text-label inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold">
        Your name
        <CosmeticChatBadge badge={chatBadge} />
      </span>
    </div>
  );
}
