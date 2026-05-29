import React from "react";
import { IconSwap, IconSwapItem } from "~/components/icon-swap";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";

interface WikiSite {
  name: string;
  displayName: string;
  baseUrl: string;
  description: string;
  categoryFilter?: string;
  theme: "blue" | "indigo";
  gradient: string;
}

interface WikiSourceSelectorProps {
  wikiSites: WikiSite[];
  selectedSite: WikiSite;
  onSelectSite: (site: WikiSite) => void;
}

const logoMap: Record<string, string> = {
  ixwiki: "/images/ix-logo.svg",
  iiwiki: "/images/IIWikiLogo.png",
  althistory: "/images/althistory-logo.webp",
};

export const WikiSourceSelector: React.FC<WikiSourceSelectorProps> = ({
  selectedSite,
  onSelectSite,
  wikiSites,
}) => {
  return (
    <div className="mt-6 mb-8">
      <div className="flex items-center gap-3">
        {wikiSites
          .filter((site) => site.name !== "ixwiki")
          .map((site) => {
            const isSelected = selectedSite.name === site.name;
            return (
              <button
                key={site.name}
                onClick={() => onSelectSite(site)}
                className={cn(
                  "group relative flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-200",
                  isSelected
                    ? "border-blue-400/50 bg-blue-500/15 shadow-sm shadow-blue-500/20"
                    : "border-border/50 bg-transparent hover:border-blue-400/30 hover:bg-blue-500/5"
                )}
                title={site.displayName}
              >
                <IconSwap>
                  <IconSwapItem key={site.name}>
                    <img
                      src={withBasePath(logoMap[site.name]!)}
                      alt={site.displayName}
                      className={cn(
                        "h-6 w-6 object-contain transition-opacity duration-200",
                        isSelected ? "opacity-100" : "opacity-50 group-hover:opacity-75"
                      )}
                    />
                  </IconSwapItem>
                </IconSwap>
              </button>
            );
          })}
        <span className="text-muted-foreground ml-2 flex items-center gap-1.5 text-sm font-medium dark:text-zinc-200">
          <span>Importing from</span>
          <span className="text-foreground font-semibold dark:text-white">
            <IconSwap>
              <IconSwapItem key={selectedSite.name}>{selectedSite.displayName}</IconSwapItem>
            </IconSwap>
          </span>
        </span>
      </div>
    </div>
  );
};
