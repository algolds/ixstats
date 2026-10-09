"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Group as Users,
  StatUp as TrendingUp,
  Globe as GlobeIcon,
  ArrowRight,
  Expand as Scaling,
  Pin as LocateFixed,
  WhiteFlag as FlagIcon,
  OpenBook as BookOpen,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { GrowthArrow } from "~/components/ui/GrowthArrow";
import { cn, formatCurrency, formatPopulation } from "~/lib/utils";
import { Card, CardContent, CardFooter } from "~/components/ui/card";

interface CountryData {
  id: string;
  name: string;
  slug?: string | null;
  continent?: string | null;
  region?: string | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string | null;
  populationTier: string | null;
  landArea?: number | null;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  adjustedGdpGrowth?: number | null;
  lastCalculated: Date | string;
}

interface CountryListCardProps {
  country: CountryData;
  flagUrl?: string | null;
  flagLoading?: boolean;
}

/** The flag's dominant colour: the image drawn into a 1x1 canvas. */
function useDominantColor(imageUrl: string | null | undefined) {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 1, 1);
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        setColor(`rgb(${r}, ${g}, ${b})`);
      } catch {
        setColor(null);
      }
    };
    img.onerror = () => setColor(null);
  }, [imageUrl]);
  return color;
}

export function CountryListCard({ country, flagUrl, flagLoading }: CountryListCardProps) {
  const router = useRouter();
  const dominantColor = useDominantColor(flagUrl);

  const wikiUrl = `/wiki/${encodeURIComponent(country.name.replace(/ /g, "_"))}`;

  const detailHref = `/countries/${country.slug}`;

  return (
    // The card is a stretched link on the name (its ::after covers the card) and the IxWiki button
    // sits above it; the card draws the focus ring when the link has keyboard focus.
    <Card
      className={cn(
        "group hover:border-label-tertiary rounded-card relative flex h-full flex-col overflow-hidden",
        "has-[a[data-card-link]:focus-visible]:outline-tint has-[a[data-card-link]:focus-visible]:outline-2 has-[a[data-card-link]:focus-visible]:outline-offset-2",
        dominantColor && "border-l-2"
      )}
      // The flag's dominant colour is data, not decoration: a thin identity edge.
      style={dominantColor ? { borderLeftColor: dominantColor } : undefined}
    >
      <CardContent className="min-h-0 grow p-3">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative h-6 w-8 shrink-0">
              {flagLoading && <Skeleton className="h-6 w-8 rounded" />}
              {!flagLoading && flagUrl && (
                <img
                  src={flagUrl}
                  alt={`Flag of ${country.name}`}
                  className="border-separator h-6 w-8 rounded object-cover"
                />
              )}
              {!flagLoading && !flagUrl && (
                <div className="bg-fill-3 flex h-6 w-8 items-center justify-center rounded border">
                  <FlagIcon aria-hidden="true" className="text-label-secondary h-4 w-4" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-label text-headline truncate" title={country.name}>
                <Link
                  href={detailHref}
                  data-card-link=""
                  className="outline-none after:absolute after:inset-0 after:content-['']"
                >
                  {country.name}
                </Link>
              </h3>
              {(country.continent || country.region) && (
                <div className="text-label-secondary text-footnote mt-0.5 flex items-center truncate">
                  <LocateFixed
                    aria-hidden="true"
                    className="text-label-secondary mr-1 h-3 w-3 shrink-0"
                  />
                  <span className="truncate">
                    {country.continent || "—"}
                    {country.continent && country.region ? " – " : ""}
                    {country.region || "—"}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                router.push(wikiUrl);
              }}
              aria-label={`View ${country.name} on IxWiki`}
              className="relative z-10 h-7 w-7"
            >
              <BookOpen aria-hidden="true" className="text-label-secondary h-3.5 w-3.5" />
            </Button>
            <ArrowRight
              aria-hidden="true"
              className="text-label-secondary group-hover:text-label group-focus-within:text-label h-4 w-4 transition-[color,translate] duration-150 motion-safe:group-focus-within:translate-x-0.5 motion-safe:group-hover:translate-x-0.5"
            />
          </div>
        </div>

        <div className="text-footnote mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Users aria-hidden="true" className="text-label-secondary h-3 w-3" />
            <span>{formatPopulation(country.currentPopulation)}</span>
          </div>
          <div className="flex items-center gap-1">
            {country.adjustedGdpGrowth != null ? (
              <GrowthArrow value={country.adjustedGdpGrowth * 100} iconOnly size={12} />
            ) : (
              <TrendingUp aria-hidden="true" className="text-label-secondary h-3 w-3" />
            )}
            <span>{formatCurrency(country.currentGdpPerCapita)}</span>
          </div>
          <div className="flex items-center gap-1">
            <GlobeIcon aria-hidden="true" className="text-label-secondary h-3 w-3" />
            <span>{formatCurrency(country.currentTotalGdp)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Scaling aria-hidden="true" className="text-label-secondary h-3 w-3" />
            <span>
              {country.populationDensity != null
                ? `${country.populationDensity.toFixed(0)}/km²`
                : "N/A"}
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex min-h-0 items-center justify-between gap-2 px-3 pt-0 pb-3">
        <Badge variant="default">{country.economicTier ?? "—"}</Badge>
        <Badge variant="outline">{country.populationTier ?? "—"}</Badge>
      </CardFooter>
    </Card>
  );
}
