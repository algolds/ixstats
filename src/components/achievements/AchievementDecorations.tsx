"use client";

import React, { type CSSProperties } from "react";
import { Lock } from "iconoir-react";
import { cn } from "~/lib/utils";
import { accentColor } from "~/lib/design/identity";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import type { CategoryTheme } from "./constants";

/** The icon as a CSS mask image, for the jewel and ghost-heraldry layers (`--heraldry-mask`). */
function maskVar(iconPath: string): string {
  return `url("${iconPath.replace(/"/g, '\\"')}")`;
}

/**
 * The aurora's secondary hue (`--facet-accent-2`).
 */
function auroraStyle(categoryTheme: CategoryTheme): CSSProperties {
  return { "--facet-accent-2": accentColor(categoryTheme.accent2) } as CSSProperties;
}

/**
 * Jewel achievement icon: the achievement icon filled with a category-tuned metallic gem gradient (`facet-jewel`, styles/facet/identity.css). Locked: a
 * faint blurred icon under a lock.
 */
export function JewelAchievementIcon({
  iconPath,
  categoryTheme,
  isUnlocked,
  className = "h-7.5 w-7.5",
}: {
  iconPath: string;
  categoryTheme: CategoryTheme;
  isUnlocked: boolean;
  className?: string;
}) {
  if (!isUnlocked) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <img
          src={iconPath}
          alt=""
          className="size-6 object-contain opacity-20 blur-[1.5px]"
          loading="lazy"
        />
        <Lock role="img" aria-label="Locked" className="text-label-secondary absolute size-5" />
      </div>
    );
  }

  const [from, via, to] = categoryTheme.jewel;
  return (
    <div
      aria-hidden
      className={cn(className, "facet-jewel drop-shadow-md")}
      style={
        {
          "--heraldry-mask": maskVar(iconPath),
          "--jewel-from": from,
          "--jewel-via": via,
          "--jewel-to": to,
        } as CSSProperties
      }
    />
  );
}

/**
 * Achievement card backdrop, layered from the identity sheet:
 * - the dot texture,
 * - the multi-stop aurora mesh (`facet-aurora`: category → secondary hue, .4 → .75 on card hover),
 * - the category radiance from the top (`facet-radiance`, .45 → .7 on card hover),
 * - the holographic foil sheen on unlocked epic/legendary achievements (`facet-foil`),
 * - the 144px ghost heraldic watermark of the icon in the bottom-right corner
 *   (`facet-ghost-heraldry`).
 * All decorative (`aria-hidden`, no pointer events). Render it as the first children of a
 * `relative overflow-hidden` card and keep the content `relative`; the hover brighten follows the
 * card (the layers' direct parent).
 */
export function AchievementCardBackdrop({
  iconPath,
  categoryTheme,
  isUnlocked,
  isLegendaryOrEpic = false,
}: {
  iconPath: string;
  categoryTheme: CategoryTheme;
  isUnlocked: boolean;
  /** Adds the foil sheen (unlocked only). */
  isLegendaryOrEpic?: boolean;
}) {
  return (
    <>
      <TextureOverlay texture="dots" opacity={0.035} />

      <span
        aria-hidden
        data-interactive={isUnlocked ? "true" : undefined}
        className="facet-aurora absolute -inset-px rounded-[inherit] print:hidden"
        style={auroraStyle(categoryTheme)}
      />

      <span
        aria-hidden
        data-interactive={isUnlocked ? "true" : undefined}
        className="facet-radiance absolute inset-0 rounded-[inherit] print:hidden"
      />

      {isLegendaryOrEpic && isUnlocked && (
        <span
          aria-hidden
          className="facet-foil absolute -inset-px rounded-[inherit] print:hidden"
        />
      )}

      <span
        aria-hidden
        className="facet-ghost-heraldry absolute -right-6 -bottom-6 size-36 print:hidden"
        style={{ "--heraldry-mask": maskVar(iconPath) } as CSSProperties}
      />
    </>
  );
}
