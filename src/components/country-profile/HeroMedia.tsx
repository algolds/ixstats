"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Expand, Map as MapIcon, MediaImage, Sparks, WhiteFlag } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { FacetMaterial } from "~/components/ui/facet";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { withBasePath } from "~/lib/base-path";
import type { BannerMode } from "~/app/countries/[slug]/_types";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <Skeleton className="size-full" /> }
);

const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

/** The cover image in the hero's media slot. */
export interface HeroCover {
  mode: BannerMode;
  /** The image for the mode, or null to show the live map instead. */
  url: string | null;
  /** Owner only: change the cover (saved per country on this device). */
  onChange?: (mode: BannerMode, customUrl?: string) => void;
}

const COVER_OPTIONS: {
  mode: BannerMode;
  label: string;
  description: string;
  icon: typeof MapIcon;
}[] = [
  {
    mode: "dynamic",
    label: "Landscape",
    description: "A photo matched to the nation",
    icon: Sparks,
  },
  { mode: "flag", label: "Flag", description: "The national flag", icon: WhiteFlag },
  { mode: "custom", label: "Media library", description: "Choose any image", icon: MediaImage },
  { mode: "gradient", label: "Map", description: "The live territory map", icon: MapIcon },
];

function resolveSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  return /^(https?:|data:|blob:)/.test(src) ? src : withBasePath(src);
}

/** The flag as a bordered tile; the first letter of the name when there is no flag. */
export function FlagTile({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveSrc(src);
  return (
    <div className="bg-surface-secondary border-separator rounded-control-lg shadow-card relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden border sm:h-16 sm:w-24">
      {resolved && !failed ? (
        // oxlint-disable-next-line nextjs/no-img-element -- remote flag, fixed tile
        <img
          src={resolved}
          alt={`Flag of ${name}`}
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden className="text-title-2 text-label-secondary">
          {name.charAt(0)}
        </span>
      )}
    </div>
  );
}

/**
 * CoverOptions — the owner's cover choices (Map, Landscape, Flag, Media library) as a list, on
 * the document's back face. Saved per country on this device.
 */
export function CoverOptions({
  cover,
}: {
  cover: HeroCover & { onChange: NonNullable<HeroCover["onChange"]> };
}) {
  const [libraryOpen, setLibraryOpen] = useState(false);
  return (
    <>
      <FacetList>
        <FacetListSection header="Cover" footer="Saved on this device; visitors see the map.">
          {COVER_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <FacetRow
                key={option.mode}
                leading={<Icon aria-hidden className="text-label-secondary size-4" />}
                title={option.label}
                subtitle={option.description}
                selected={cover.mode === option.mode}
                accessory={cover.mode === option.mode ? "check" : undefined}
                onClick={() =>
                  option.mode === "custom" ? setLibraryOpen(true) : cover.onChange(option.mode)
                }
              />
            );
          })}
        </FacetListSection>
      </FacetList>
      {libraryOpen && (
        <MediaSearchModal
          isOpen={libraryOpen}
          onClose={() => setLibraryOpen(false)}
          onImageSelect={(url: string) => {
            cover.onChange("custom", url);
            setLibraryOpen(false);
          }}
        />
      )}
    </>
  );
}

/**
 * CoverMedia — the country page's media slot: the live territory map, or the cover photo the
 * owner picked on this device (else the map again if it fails to load), with an expand control
 * that opens the Map tab.
 */
export function CoverMedia({
  cover,
  countryId,
  onExpand,
}: {
  cover: HeroCover | null;
  countryId: string;
  onExpand?: () => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const src = resolveSrc(cover?.url);
  return (
    <>
      {src && failed !== src ? (
        // oxlint-disable-next-line nextjs/no-img-element -- remote cover photo
        <img
          src={src}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        <CountryMapEmbed
          countryId={countryId}
          height="h-full"
          showNeighbors={true}
          showCities={true}
          showSubdivisions={true}
          interactive={true}
          boundsPadding={30}
        />
      )}
      {onExpand && (
        <FacetMaterial
          layer="chrome"
          className="z-raised rounded-control-sm absolute top-3 left-3 print:hidden"
        >
          <Button variant="ghost" size="icon-sm" aria-label="Open the map" onClick={onExpand}>
            <Expand aria-hidden />
          </Button>
        </FacetMaterial>
      )}
    </>
  );
}
