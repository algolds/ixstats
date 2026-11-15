"use client";

import { useState } from "react";
import type { ProfileMedia } from "~/app/countries/[slug]/_utils/profileLayer";
import { CardImageUploadModal } from "~/components/mycountry/shared/primitives";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { proxyCardArtwork } from "~/lib/cards/ns-image-proxy";
import { api } from "~/trpc/react";

/** Each Factbook block and the owner's image slot that pins its cover (`card_background_images`). */
const BLOCKS = [
  { key: "economy", label: "Economy & people", slot: "economic_indicators" },
  { key: "state", label: "State", slot: "government" },
  { key: "foreign", label: "Foreign affairs", slot: "diplomacy" },
] as const;

type Slot = (typeof BLOCKS)[number]["slot"];

/**
 * FactbookImages — on the profile's back face, the owner's choice of each Factbook block's cover:
 * the current image, whether it is pinned or automatic, Change (the card image picker: presets,
 * wiki images or an upload) and Clear (back to automatic). Writes check country ownership on the
 * server; the profile's covers refresh after either.
 */
export function FactbookImages({
  countryId,
  covers,
  hasMap,
  active,
}: {
  countryId: string;
  covers: ProfileMedia["sectionCovers"];
  /** The country has map geometry, so an imageless block shows its map crop. */
  hasMap: boolean;
  /** The back face is turned to: the pins may load. */
  active: boolean;
}) {
  const [editing, setEditing] = useState<Slot | null>(null);
  const utils = api.useUtils();
  const pins = api.cardImages.getAllByCountry.useQuery({ countryId }, { enabled: active });
  const refresh = () => {
    void utils.cardImages.getAllByCountry.invalidate({ countryId });
    void utils.countries.getPublicRecord.invalidate();
  };
  const clear = api.cardImages.delete.useMutation({ onSuccess: refresh });

  return (
    <Card padding="md" aria-labelledby="factbook-images-title" role="region">
      <h3 id="factbook-images-title" className="text-headline text-label">
        Factbook images
      </h3>
      <p className="text-footnote text-label-secondary mt-1">
        Each block picks a picture from its own wiki articles, or its map. Pin one to choose it.
      </p>
      <ul className="divide-separator mt-3 flex flex-col divide-y">
        {BLOCKS.map(({ key, label, slot }) => {
          const pinned = pins.data?.[slot]?.imageUrl ?? null;
          const shown = pinned ?? covers[key]?.url ?? null;
          return (
            <li key={key} className="flex items-center gap-3 py-2.5">
              <span className="bg-fill-4 rounded-control-sm h-10 w-16 shrink-0 overflow-hidden">
                {shown && (
                  // oxlint-disable-next-line nextjs/no-img-element -- remote cover image
                  <img
                    src={proxyCardArtwork(shown)}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-callout text-label block">{label}</span>
                <span className="text-caption text-label-secondary block">
                  {pinned
                    ? "Pinned"
                    : shown
                      ? "Automatic"
                      : hasMap
                        ? "Automatic: map"
                        : "Automatic: no image yet"}
                </span>
              </span>
              <Button variant="secondary" size="sm" onClick={() => setEditing(slot)}>
                Change
              </Button>
              {pinned && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={clear.isPending}
                  onClick={() => clear.mutate({ countryId, cardType: slot })}
                >
                  Clear
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {editing && (
        <CardImageUploadModal
          isOpen
          onClose={() => setEditing(null)}
          countryId={countryId}
          cardType={editing}
          currentImageUrl={pins.data?.[editing]?.imageUrl ?? null}
          onSuccess={refresh}
        />
      )}
    </Card>
  );
}
