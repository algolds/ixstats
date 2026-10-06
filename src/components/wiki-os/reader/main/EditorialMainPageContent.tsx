import React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Globe as IconoirGlobe,
  Building as IconoirBuilding,
  Palette as IconoirPalette,
  GraphUp as IconoirGraphUp,
  MapPin as IconoirMapPin,
  Bank as IconoirBank,
  Timer as IconoirTimer,
  Shield as IconoirShield,
  Leaf as IconoirLeaf,
  Group as IconoirGroup,
  Megaphone as IconoirMegaphone,
  Cpu as IconoirCpu,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import type { MainPageContentProps } from "./types";
import { CountriesSection, RecentActivitySection } from "./MainPageSections";

const CATEGORY_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; desc: string }
> = {
  Countries: { icon: IconoirGlobe, desc: "Sovereign states & realms" },
  Companies: { icon: IconoirBuilding, desc: "Enterprises, guilds & trade" },
  Culture: { icon: IconoirPalette, desc: "Arts, faith & heritage" },
  Economy: { icon: IconoirGraphUp, desc: "Finance, markets & currency" },
  Geography: { icon: IconoirMapPin, desc: "Oceans, terrain & realms" },
  Government: { icon: IconoirBank, desc: "Crowns, laws & treaties" },
  History: { icon: IconoirTimer, desc: "Chronicles, eras & wars" },
  Military: { icon: IconoirShield, desc: "Armed forces & defense" },
  Nature: { icon: IconoirLeaf, desc: "Flora, fauna & biomes" },
  People: { icon: IconoirGroup, desc: "Figures, leaders & lineages" },
  Politics: { icon: IconoirMegaphone, desc: "Parties & diplomacy" },
  Technology: { icon: IconoirCpu, desc: "Industry & sciences" },
};

export function EditorialMainPageContent({
  categories,
  recentChanges,
  isLoadingRecent,
  countries,
}: MainPageContentProps) {
  return (
    <div className="w-full space-y-5 pb-2 select-none sm:space-y-6">
      <div className="grid grid-cols-1 items-stretch gap-6 sm:gap-8 lg:grid-cols-12">
        {/* Left Column (col-span-6): Topic Taxonomy Matrix */}
        <section aria-label="Browse by topic" className="flex h-full flex-col lg:col-span-6">
          <div className="border-separator mb-3 flex items-center justify-between border-b pb-2">
            <h2 className="text-label text-headline">Browse by topic</h2>
            <Link
              href={withBasePath("/util/categories/Countries")}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="text-label-secondary hover:text-label group/all text-caption flex items-center gap-1 transition-colors"
            >
              <span>All topics</span>
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/all:translate-x-0.5" />
            </Link>
          </div>

          <div className="rounded-card border-separator bg-surface sm:rounded-card flex flex-1 flex-col justify-between border p-3 sm:p-3">
            <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2">
              {categories.map((cat) => {
                const meta = CATEGORY_META[cat.name] || {
                  icon: IconoirGlobe,
                  desc: "Encyclopedia entries",
                };
                const Icon = meta.icon;
                return (
                  <Link
                    key={cat.name}
                    href={withBasePath(`/util/categories/${encodeURIComponent(cat.name)}`)}
                    data-cuelume-press="page"
                    data-cuelume-hover="tick"
                    className={cn(
                      "rounded-row flex items-start gap-2 p-2 sm:p-3",
                      "hover:bg-fill-4 group transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150"
                    )}
                  >
                    <div
                      className="border-separator rounded-control mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center border transition-transform"
                      style={{ backgroundColor: `${cat.color}18`, color: cat.color }}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="text-label group-hover:text-label text-caption truncate font-semibold">
                        {cat.name}
                      </span>
                      <span className="text-label-secondary text-footnote mt-0.5 truncate leading-snug">
                        {meta.desc}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <RecentActivitySection recentChanges={recentChanges} isLoadingRecent={isLoadingRecent} />
      </div>

      <CountriesSection countries={countries} />
    </div>
  );
}
