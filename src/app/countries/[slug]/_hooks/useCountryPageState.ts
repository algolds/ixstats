"use client";

// Refactored from main CountryPage - manages all client-side state for country page
import { useState, useEffect, useCallback } from "react";
import { unsplashService } from "~/lib/unsplash-service";
import { IxnayWikiService, type CountryInfobox } from "~/lib/mediawiki-service";

type TabType = "overview" | "mycountry" | "lore" | "diplomatic" | "diplomacy";

interface Country {
  id: string;
  name: string;
  economicTier: string;
  populationTier: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  continent?: string | null;
}

export function useCountryPageState(country: Country | undefined) {
  // Tab management
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [isMounted, setIsMounted] = useState(false);

  // Display toggles
  const [showGdpPerCapita, setShowGdpPerCapita] = useState(true);
  const [showFullPopulation, setShowFullPopulation] = useState(false);
  const [showCountryActions, setShowCountryActions] = useState(false);

  // Wiki data
  const [wikiInfobox, setWikiInfobox] = useState<CountryInfobox | null>(null);
  const [wikiIntro, setWikiIntro] = useState<string[]>([]);

  // Image data
  const [unsplashImageUrl, setUnsplashImageUrl] = useState<string | undefined>();

  // Prevent hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load Unsplash header image
  useEffect(() => {
    if (country && !unsplashImageUrl) {
      unsplashService
        .getCountryHeaderImage(
          country.economicTier,
          country.populationTier,
          country.name,
          country.continent || undefined
        )
        .then((imageData) => {
          setUnsplashImageUrl(imageData.url);
          if (imageData.downloadUrl) {
            void unsplashService.trackDownload(imageData.downloadUrl);
          }
        })
        .catch((error) => {
          console.warn("Failed to load Unsplash image:", error);
          setUnsplashImageUrl(undefined);
        });
    }
  }, [country, unsplashImageUrl]);

  // Load wiki data (infobox and intro)
  useEffect(() => {
    if (!country?.name) return;

    const wikiService = new IxnayWikiService();

    // Load infobox
    wikiService
      .getCountryInfobox(country.name)
      .then((infobox: CountryInfobox | null) => {
        setWikiInfobox(infobox);
      })
      .catch((error: Error) => {
        console.warn("Failed to load wiki infobox:", error);
      });

    // Load wiki intro text - same parsing logic as WikiIntelligenceTab
    wikiService
      .getPageWikitext(country.name)
      .then((wikitext) => {
        if (typeof wikitext === "string" && wikitext.length > 0) {
          const infoboxTemplate = wikiService.extractInfoboxTemplate(wikitext);

          let contentAfterInfobox = wikitext;
          if (infoboxTemplate) {
            const infoboxIndex = wikitext.indexOf(infoboxTemplate);
            if (infoboxIndex !== -1) {
              contentAfterInfobox = wikitext
                .substring(infoboxIndex + infoboxTemplate.length)
                .trim();
            }
          }

          const beforeFirstHeading = contentAfterInfobox.split(/^==/m)[0] || contentAfterInfobox;

          // Clean wikitext
          let cleanContent = beforeFirstHeading
            .replace(/\{\{wp\|[^\|\}]+\|([^\}]+)\}\}/g, "$1")
            .replace(/\{\{wp\|([^\}]+)\}\}/g, "$1")
            .replace(/\{\{lang\|[^\|]+\|([^\}]+)\}\}/g, "$1")
            .replace(/\{\{nowrap\|([^\}]+)\}\}/g, "$1")
            .replace(/\{\{convert[^\}]*\}\}/gi, "")
            .replace(/\{\{[^\}]+\|([^\|\}]+)\}\}/g, "$1")
            .replace(/\{\{[^\}]+\}\}/g, "")
            .replace(/\[\[Template:[^\]]*\]\]/gi, "")
            .replace(/\[\[Category:[^\]]*\]\]/gi, "")
            .replace(/\[\[File:[^\]]*\]\]/gi, "")
            .replace(/\[\[Image:[^\]]*\]\]/gi, "")
            .replace(/\[\[[a-z]{2,3}:[^\]]*\]\]/gi, "")
            .replace(/<ref[^>]*>.*?<\/ref>/gi, "")
            .replace(/<ref[^>]*\/>/gi, "")
            .replace(/<!--.*?-->/gs, "")
            .replace(/\{\|.*?\|\}/gs, "")
            .replace(/__[A-Z_]+__/g, "")
            .replace(/\n\n+/g, "|||PARAGRAPH_BREAK|||")
            .replace(/[ \t]+/g, " ")
            .replace(/\n/g, " ")
            .trim();

          // Process links and formatting
          const processedContent = cleanContent
            .replace(/\[\[([^\[\]\|]+)\|([^\[\]]+?)\]\]/g, (_, page, display) => {
              if (page.toLowerCase().includes("template:")) return "";
              return `<a href="https://ixwiki.com/wiki/${encodeURIComponent(
                page
              )}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${display}</a>`;
            })
            .replace(/\[\[([^\[\]]+?)\]\]/g, (_, page) => {
              if (page.toLowerCase().includes("template:")) return "";
              return `<a href="https://ixwiki.com/wiki/${encodeURIComponent(
                page
              )}" class="wiki-link text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline" target="_blank" rel="noopener noreferrer">${page}</a>`;
            })
            .replace(
              /\[([^\s\]]+)\s+([^\]]+)\]/g,
              '<a href="$1" class="external-link text-green-600 dark:text-green-400 hover:text-green-500 dark:hover:text-green-300 underline" target="_blank">$2</a>'
            )
            .replace(
              /'''([^']*)'''/g,
              '<strong class="font-semibold text-foreground">$1</strong>'
            )
            .replace(/''([^']*)''/g, '<em class="italic text-muted-foreground">$1</em>');

          // Split into paragraphs
          const paragraphs = processedContent
            .split("|||PARAGRAPH_BREAK|||")
            .map((p) => p.trim())
            .filter((p) => p.length > 50)
            .slice(0, 3);

          if (paragraphs.length > 0) {
            setWikiIntro(paragraphs);
          }
        }
      })
      .catch((error: Error) => {
        console.warn("Failed to load wiki intro:", error);
      });
  }, [country?.name]);

  const toggleGdpDisplay = useCallback(() => {
    setShowGdpPerCapita((prev) => !prev);
  }, []);

  const togglePopulationDisplay = useCallback(() => {
    setShowFullPopulation((prev) => !prev);
  }, []);

  return {
    // Tab state
    activeTab,
    setActiveTab,
    isMounted,

    // Display toggles
    showGdpPerCapita,
    showFullPopulation,
    showCountryActions,
    setShowCountryActions,
    toggleGdpDisplay,
    togglePopulationDisplay,

    // Wiki data
    wikiInfobox,
    wikiIntro,

    // Image data
    unsplashImageUrl,
  };
}
