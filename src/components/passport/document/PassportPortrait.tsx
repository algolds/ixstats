"use client";

import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import type { PublicCosmetics } from "~/lib/vault/public-cosmetics";

interface PassportPortraitProps {
  displayName: string;
  avatarUrl: string | null;
  /** The passport holder's equipped cosmetics, as every visitor sees them (VT-12). */
  cosmetics: PublicCosmetics | null;
}

/** The passport photo, wearing the holder's equipped avatar glow and neon frame. */
export function PassportPortrait({ displayName, avatarUrl, cosmetics }: PassportPortraitProps) {
  const portrait = (
    <div className="bg-fill-3 border-separator rounded-card shadow-card relative h-44 w-38 overflow-hidden border-2 sm:h-52 sm:w-44">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          className="h-full w-full transform-gpu object-cover select-none"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="bg-fill-3 text-large-title text-label-secondary flex h-full w-full items-center justify-center select-none">
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      {cosmetics && <NeonFrameOverlay neonFrame={cosmetics.neonFrame} className="rounded-card" />}
    </div>
  );

  if (!cosmetics?.avatarGlow.enabled) return portrait;
  return (
    <AvatarGlow avatarGlow={cosmetics.avatarGlow} roundedClass="rounded-card">
      {portrait}
    </AvatarGlow>
  );
}
