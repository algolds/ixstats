"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Camera, MediaImage, Sparks, WhiteFlag, Xmark } from "iconoir-react";
import { CountryOwnerRibbonRack } from "~/components/achievements/FloatingRibbonRack";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetMaterial } from "~/components/ui/facet";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Stat } from "~/components/ui/stat";
import { withBasePath } from "~/lib/base-path";
import { stripHtml } from "~/lib/utils/sanitize-html";
import { cn } from "~/lib/utils/cn";
import type { BannerMode } from "~/app/countries/[slug]/_types";
import { CountryIdentityStrip, type CountryIdentityStripProps } from "./CountryIdentityStrip";
import type { VitalStat } from "./vitals";
import { Card } from "~/components/ui/card";

const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

/** The cover image above the hero. */
export interface HeroCover {
  mode: BannerMode;
  /** The image for the mode, or null for no cover band. */
  url: string | null;
  /** Owner only: change the cover (saved per country on this device). */
  onChange?: (mode: BannerMode, customUrl?: string) => void;
}

const COVER_OPTIONS: {
  mode: BannerMode;
  label: string;
  description: string;
  icon: typeof Camera;
}[] = [
  {
    mode: "dynamic",
    label: "Landscape",
    description: "A photo matched to the nation",
    icon: Sparks,
  },
  { mode: "flag", label: "Flag", description: "The national flag", icon: WhiteFlag },
  { mode: "custom", label: "Media library", description: "Choose any image", icon: MediaImage },
  { mode: "gradient", label: "No cover", description: "Identity only", icon: Xmark },
];

function resolveSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  return /^(https?:|data:|blob:)/.test(src) ? src : withBasePath(src);
}

/** The flag as a bordered tile; the first letter of the name when there is no flag. */
function FlagTile({ src, name, lifted }: { src: string | null; name: string; lifted: boolean }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveSrc(src);
  return (
    <div
      className={cn(
        "bg-surface-secondary border-separator rounded-control-lg shadow-card relative flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden border sm:h-16 sm:w-24",
        lifted && "-mt-12 sm:-mt-14"
      )}
    >
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

function CoverPicker({
  cover,
}: {
  cover: HeroCover & { onChange: NonNullable<HeroCover["onChange"]> };
}) {
  const [open, setOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <FacetMaterial material="thin" className="rounded-control-sm">
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm">
              <Camera aria-hidden />
              <span className="max-sm:sr-only">Change cover</span>
            </Button>
          </PopoverTrigger>
        </FacetMaterial>
        <PopoverContent align="end" className="p-2">
          <FacetList variant="plain">
            <FacetListSection header="Cover">
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
                    onClick={() => {
                      setOpen(false);
                      if (option.mode === "custom") setLibraryOpen(true);
                      else cover.onChange(option.mode);
                    }}
                  />
                );
              })}
            </FacetListSection>
          </FacetList>
        </PopoverContent>
      </Popover>
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

interface CountryHeroProps {
  name: string;
  officialName?: string | null;
  flagUrl: string | null;
  /** Continent · region · realm, above the name. */
  eyebrow?: string | null;
  motto?: string | null;
  /** Identity facts in reading order (capital, anthem, demonym…); empty values are skipped. */
  facts?: readonly { label: string; value: string | null | undefined }[];
  realm?: CountryIdentityStripProps["realm"];
  sovereign?: CountryIdentityStripProps["sovereign"];
  /** Headline figures (population, GDP, GDP per capita, land area). */
  stats?: readonly VitalStat[];
  cover?: HeroCover | null;
  /** Loads the owner's ribbon rack beside the name. */
  countrySlug?: string | null;
  /** `h1` on a page of its own; `h2` when the page already has one. */
  headingLevel?: 1 | 2;
  id?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * CountryHero — a country's identity for the Command profile and the Factbook: the cover as a
 * photo band above the content (never a wash under text), the flag tile lifted onto it, the name
 * with the owner's ribbons, the realm and IxnayID strip, the motto and identity facts, and the
 * headline figures.
 */
export function CountryHero({
  name,
  officialName,
  flagUrl,
  eyebrow,
  motto,
  facts = [],
  realm,
  sovereign,
  stats = [],
  cover,
  countrySlug,
  headingLevel = 1,
  id,
  className,
  children,
}: CountryHeroProps) {
  const [coverFailed, setCoverFailed] = useState<string | null>(null);
  const coverSrc = resolveSrc(cover?.url);
  const showCover = !!coverSrc && coverFailed !== coverSrc;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  // Wiki infobox values can carry raw HTML (<div>, <br>…); these fields are plain text.
  const plainMotto = motto ? stripHtml(motto) : null;
  const plainOfficialName = officialName ? stripHtml(officialName) : null;
  const shownFacts = facts.flatMap((f) => {
    const value = f.value ? stripHtml(f.value) : "";
    return value ? [{ label: f.label, value }] : [];
  });

  return (
    <Card id={id} className={cn("overflow-hidden", className)}>
      {showCover && (
        <div className="bg-surface-secondary relative h-32 sm:h-44 lg:h-52">
          {/* oxlint-disable-next-line nextjs/no-img-element -- remote cover photo */}
          <img
            src={coverSrc}
            alt=""
            className="size-full object-cover"
            onError={() => setCoverFailed(coverSrc)}
          />
        </div>
      )}
      {cover?.onChange && (
        <div className="z-raised absolute top-3 right-3 print:hidden">
          <CoverPicker cover={{ ...cover, onChange: cover.onChange }} />
        </div>
      )}

      <div className="relative p-5 sm:p-6">
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <FlagTile src={flagUrl} name={name} lifted={showCover} />
            <div className="min-w-0 flex-1 space-y-1">
              {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <Heading className="text-display text-label text-balance">{name}</Heading>
                {countrySlug && <CountryOwnerRibbonRack countrySlug={countrySlug} />}
              </div>
              {plainOfficialName && plainOfficialName !== name && (
                <p className="text-callout text-label-secondary">{plainOfficialName}</p>
              )}
            </div>
          </div>

          {plainMotto && (
            <p className="text-title-3 text-label-secondary max-w-[38rem] font-normal text-pretty">
              <span className="sr-only">Motto: </span>
              &ldquo;{plainMotto}&rdquo;
            </p>
          )}

          <div className="flex flex-col gap-4">
            <CountryIdentityStrip realm={realm} sovereign={sovereign} />
            {shownFacts.length > 0 && (
              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                {shownFacts.map((f) => (
                  <div key={f.label} className="min-w-0">
                    <dt className="text-footnote text-label-secondary">{f.label}</dt>
                    <dd className="text-body text-label">{f.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          {stats.length > 0 && (
            <dl className="border-separator grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-5 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.key}>
                  <dt className="sr-only">{s.label}</dt>
                  <dd>
                    <Stat label={s.label} value={s.value} delta={s.delta} hint={s.hint} />
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {children}
        </div>
      </div>
    </Card>
  );
}
