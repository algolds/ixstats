"use client";

import React, { type CSSProperties } from "react";
import { Lock } from "iconoir-react";
import { cn } from "~/lib/utils";
import { accentColor } from "~/lib/design/identity";
import { TEXTURE_MAX_OPACITY, TextureOverlay } from "~/components/ui/texture-overlay";
import type { CategoryTheme } from "./constants";

/**
 * The aurora's secondary hue (`--facet-accent-2`).
 */
function auroraStyle(categoryTheme: CategoryTheme): CSSProperties {
  return { "--facet-accent-2": accentColor(categoryTheme.accent2) } as CSSProperties;
}

/**
 * The achievement's icon, in the colour of the pedestal it sits on. Locked: a faint blurred icon
 * under a lock.
 */
export function AchievementIcon({
  icon: Icon,
  isUnlocked,
  className = "size-7.5",
}: {
  icon: React.ComponentType<{ className?: string }>;
  isUnlocked: boolean;
  className?: string;
}) {
  if (!isUnlocked) {
    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <Icon aria-hidden className="size-6 opacity-20 blur-[1.5px]" />
        <Lock role="img" aria-label="Locked" className="text-label-secondary absolute size-5" />
      </div>
    );
  }

  return <Icon aria-hidden className={cn(className, "drop-shadow-md")} />;
}

/**
 * Achievement card backdrop, layered from the content-art sheet (styles/card-art.css):
 * - the dot texture, drawn in the category's accent on an unlocked card (neutral ink and fainter on a locked one),
 * - the multi-stop aurora mesh (`facet-aurora`: category → secondary hue, .4 → .75 on card hover),
 * - the holographic foil sheen on unlocked epic/legendary achievements (`facet-foil`).
 * All decorative (`aria-hidden`, no pointer events). Render it as the first children of a
 * `relative overflow-hidden` card and keep the content `relative`; the hover brighten follows the
 * card (the layers' direct parent).
 */
export function AchievementCardBackdrop({
  categoryTheme,
  isUnlocked,
  isLegendaryOrEpic = false,
}: {
  categoryTheme: CategoryTheme;
  isUnlocked: boolean;
  /** Adds the foil sheen (unlocked only). */
  isLegendaryOrEpic?: boolean;
}) {
  return (
    <>
      {isUnlocked ? (
        <span
          aria-hidden
          data-slot="achievement-texture"
          className="pointer-events-none absolute inset-0"
          style={{ "--facet-texture-color": accentColor(categoryTheme.accent) } as CSSProperties}
        >
          <TextureOverlay texture="dots" opacity={TEXTURE_MAX_OPACITY} />
        </span>
      ) : (
        <TextureOverlay texture="dots" opacity={0.035} />
      )}

      <span
        aria-hidden
        data-interactive={isUnlocked ? "true" : undefined}
        className="facet-aurora absolute -inset-px rounded-[inherit] print:hidden"
        style={auroraStyle(categoryTheme)}
      />

      {isLegendaryOrEpic && isUnlocked && (
        <span
          aria-hidden
          className="facet-foil absolute -inset-px rounded-[inherit] print:hidden"
        />
      )}
    </>
  );
}
