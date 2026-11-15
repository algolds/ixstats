"use client";

import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import type { PublicCosmetics } from "~/lib/vault/public-cosmetics";
import { assetUrl } from "~/lib/base-path";

interface PassportPortraitProps {
  displayName: string;
  avatarUrl: string | null;
  /** The passport holder's equipped cosmetics, as every visitor sees them (VT-12). */
  cosmetics: PublicCosmetics | null;
  /** `page` on the Passport itself; `compact` on Halo's Passport side. */
  size?: "page" | "compact";
}

/** The passport photo, wearing the holder's equipped avatar glow and neon frame. */
export function PassportPortrait({
  displayName,
  avatarUrl,
  cosmetics,
  size = "page",
}: PassportPortraitProps) {
  const rounded = size === "page" ? "rounded-card" : "rounded-row";
  const portrait = (
    <div
      className={
        size === "page"
          ? "bg-fill-3 border-separator rounded-card shadow-card relative h-44 w-38 overflow-hidden border-2 sm:h-52 sm:w-44"
          : "bg-fill-3 border-separator rounded-row relative h-18 w-15 shrink-0 overflow-hidden border-2"
      }
    >
      {avatarUrl ? (
        <img
          src={assetUrl(avatarUrl) ?? undefined}
          alt={displayName}
          className="h-full w-full transform-gpu object-cover select-none"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={`bg-fill-3 text-label-secondary flex h-full w-full items-center justify-center select-none ${size === "page" ? "text-large-title" : "text-title-3"}`}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      {cosmetics && <NeonFrameOverlay neonFrame={cosmetics.neonFrame} className={rounded} />}
    </div>
  );

  if (!cosmetics?.avatarGlow.enabled) return portrait;
  return (
    <AvatarGlow avatarGlow={cosmetics.avatarGlow} roundedClass={rounded}>
      {portrait}
    </AvatarGlow>
  );
}
