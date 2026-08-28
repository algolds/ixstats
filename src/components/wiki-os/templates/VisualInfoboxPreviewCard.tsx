"use client";
// src/components/wiki-os/templates/VisualInfoboxPreviewCard.tsx
// Authentic High-Fidelity WikiOS Live Infobox Preview Component

import React, { useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";

interface VisualInfoboxPreviewCardProps {
  templateName: string;
  variantId?: string;
  variantLabel?: string;
  category?: string;
  params: Array<{
    name: string;
    label?: string;
    example?: string;
    type?: string;
    variantOnly?: string[];
  }>;
  customValues?: Record<string, string>;
  className?: string;
}

export function VisualInfoboxPreviewCard({
  templateName,
  variantId,
  variantLabel,
  params = [],
  customValues = {},
  className,
}: VisualInfoboxPreviewCardProps) {
  const cleanName = templateName.replace(/^Template:/i, "").trim();

  // Filter params for active variant
  const activeParams = useMemo(() => {
    return params.filter((p) => {
      if (!p.variantOnly || p.variantOnly.length === 0) return true;
      if (!variantId) return true;
      return p.variantOnly.includes(variantId);
    });
  }, [params, variantId]);

  // Group params into authentic MediaWiki infobox sections
  const groupedSections = useMemo(() => {
    const general: typeof activeParams = [];
    const geography: typeof activeParams = [];
    const governance: typeof activeParams = [];
    const demographics: typeof activeParams = [];
    const economy: typeof activeParams = [];
    const military: typeof activeParams = [];
    const technical: typeof activeParams = [];
    const historical: typeof activeParams = [];

    for (const p of activeParams) {
      const n = p.name.toLowerCase();
      // Skip title / image fields from table rows since they render in the header / image slot
      if (
        n === "name" ||
        n === "title" ||
        n === "official_name" ||
        n === "native_name" ||
        n === "image" ||
        n === "image_flag" ||
        n === "image_coat" ||
        n === "image_seal" ||
        n === "image_skyline"
      ) {
        continue;
      }

      if (
        n.includes("capital") ||
        n.includes("largest_city") ||
        n.includes("coordinates") ||
        n.includes("location") ||
        n.includes("area") ||
        n.includes("elevation")
      ) {
        geography.push(p);
      } else if (
        n.includes("leader") ||
        n.includes("government") ||
        n.includes("monarch") ||
        n.includes("president") ||
        n.includes("prime_minister") ||
        n.includes("legislature") ||
        n.includes("party") ||
        n.includes("office")
      ) {
        governance.push(p);
      } else if (
        n.includes("population") ||
        n.includes("demonym") ||
        n.includes("language") ||
        n.includes("religion") ||
        n.includes("ethnic")
      ) {
        demographics.push(p);
      } else if (
        n.includes("gdp") ||
        n.includes("currency") ||
        n.includes("hdi") ||
        n.includes("revenue") ||
        n.includes("assets") ||
        n.includes("headquarters")
      ) {
        economy.push(p);
      } else if (
        n.includes("commander") ||
        n.includes("branch") ||
        n.includes("battles") ||
        n.includes("armament") ||
        n.includes("speed") ||
        n.includes("displacement") ||
        n.includes("range")
      ) {
        military.push(p);
      } else if (
        n.includes("established") ||
        n.includes("dissolved") ||
        n.includes("predecessor") ||
        n.includes("successor") ||
        n.includes("date") ||
        n.includes("born") ||
        n.includes("died")
      ) {
        historical.push(p);
      } else if (
        n.includes("manufacturer") ||
        n.includes("designer") ||
        n.includes("caliber") ||
        n.includes("weight") ||
        n.includes("length")
      ) {
        technical.push(p);
      } else {
        general.push(p);
      }
    }

    const sections = [];
    if (historical.length > 0)
      sections.push({ id: "historical", title: "Historical Timeline", items: historical });
    if (governance.length > 0)
      sections.push({ id: "governance", title: "Government & Politics", items: governance });
    if (demographics.length > 0)
      sections.push({ id: "demographics", title: "Demographics & Society", items: demographics });
    if (geography.length > 0)
      sections.push({ id: "geography", title: "Geography & Territories", items: geography });
    if (economy.length > 0)
      sections.push({ id: "economy", title: "Economy & Currency", items: economy });
    if (military.length > 0)
      sections.push({ id: "military", title: "Military & Service", items: military });
    if (technical.length > 0)
      sections.push({ id: "technical", title: "Technical Specifications", items: technical });
    if (general.length > 0)
      sections.push({ id: "general", title: "General Information", items: general });

    if (sections.length === 0 && activeParams.length > 0) {
      sections.push({ id: "all", title: "Entity Details", items: activeParams });
    }

    return sections;
  }, [activeParams]);

  // Derived Title & Subtitle
  const title =
    customValues.name ||
    customValues.common_name ||
    customValues.title ||
    cleanName.replace(/^Infobox\s+/i, "");

  const subheader =
    customValues.official_name ||
    customValues.native_name ||
    (variantLabel ? `${variantLabel} Factbook` : undefined);

  const motto = customValues.motto || customValues.national_motto;
  const anthem = customValues.anthem || customValues.national_anthem;

  const isCountryOrPlace =
    cleanName.toLowerCase().includes("country") ||
    cleanName.toLowerCase().includes("settlement") ||
    cleanName.toLowerCase().includes("city");

  return (
    <motion.aside
      key={`${cleanName}-${variantId || "default"}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      className={cn(
        "wikios-infobox facet-hierarchy-child border-border/60 bg-card/90 w-[330px] max-w-[340px] shrink-0 overflow-hidden rounded-2xl border text-[13px] leading-[1.4] shadow-xl backdrop-blur-xl select-text",
        className
      )}
      style={{ float: "none", margin: 0 }}
    >
      <table className="infobox w-full table-fixed border-collapse">
        <tbody>
          {/* ── 1. Infobox Above (Entity Title) ── */}
          <tr>
            <th
              colSpan={2}
              className="infobox-above font-brand border-border/40 bg-wiki/10 text-foreground border-b px-4 py-3 text-center text-base font-bold"
            >
              <div className="tracking-tight">{title}</div>
              {subheader && (
                <div className="infobox-subheader text-muted-foreground mt-0.5 text-xs font-normal italic">
                  {subheader}
                </div>
              )}
            </th>
          </tr>

          {/* ── 2. Media / Crest / Flag Plinth Slot ── */}
          {isCountryOrPlace ? (
            <tr>
              <td
                colSpan={2}
                className="infobox-image border-border/30 bg-secondary/15 border-b p-3 text-center"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="border-border/40 bg-background/60 flex h-20 flex-col items-center justify-center rounded-xl border p-2">
                    <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                      National Flag
                    </span>
                    <span className="text-muted-foreground/60 mt-1 font-mono text-[9px]">
                      {customValues.image_flag || "Flag.svg"}
                    </span>
                  </div>
                  <div className="border-border/40 bg-background/60 flex h-20 flex-col items-center justify-center rounded-xl border p-2">
                    <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                      Coat of Arms
                    </span>
                    <span className="text-muted-foreground/60 mt-1 font-mono text-[9px]">
                      {customValues.image_coat || "Crest.svg"}
                    </span>
                  </div>
                </div>
                {motto && (
                  <div className="text-muted-foreground mt-2 font-serif text-[11px] italic">
                    &ldquo;{motto}&rdquo;
                  </div>
                )}
              </td>
            </tr>
          ) : (
            <tr>
              <td
                colSpan={2}
                className="infobox-image border-border/30 bg-secondary/15 border-b p-3 text-center"
              >
                <div className="border-border/40 bg-background/60 flex h-24 flex-col items-center justify-center rounded-xl border p-4">
                  <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Primary Entity Image
                  </span>
                  <span className="text-muted-foreground/60 mt-1 font-mono text-[9px]">
                    {customValues.image || `${cleanName.replace(/\s+/g, "_")}.jpg`}
                  </span>
                </div>
              </td>
            </tr>
          )}

          {/* ── 3. Anthem / Motto Sub-Row (if present) ── */}
          {anthem && (
            <tr>
              <th
                scope="row"
                className="infobox-label text-muted-foreground border-border/20 w-[38%] border-b px-3 py-1.5 text-right text-xs font-medium"
              >
                Anthem
              </th>
              <td className="infobox-data text-foreground border-border/20 border-b px-3 py-1.5 text-xs font-normal">
                {anthem}
              </td>
            </tr>
          )}

          {/* ── 4. Structured Data Sections ── */}
          {groupedSections.map((sec) => (
            <React.Fragment key={sec.id}>
              <tr>
                <th
                  colSpan={2}
                  className="infobox-header text-foreground/90 border-border/40 bg-secondary/30 border-t border-b px-3 py-1.5 text-center text-xs font-semibold tracking-wider uppercase"
                >
                  {sec.title}
                </th>
              </tr>

              {sec.items.map((p) => {
                const rawVal =
                  customValues[p.name] || p.example || p.label || p.name.replace(/_/g, " ");

                return (
                  <tr key={p.name} className="hover:bg-secondary/20 transition-colors">
                    <th
                      scope="row"
                      className="infobox-label text-muted-foreground border-border/20 w-[38%] border-b px-3 py-1.5 text-right align-top text-xs font-medium break-words"
                    >
                      {p.label || p.name.replace(/_/g, " ")}
                    </th>
                    <td className="infobox-data text-foreground border-border/20 border-b px-3 py-1.5 align-top text-xs font-normal break-words">
                      {rawVal}
                    </td>
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </motion.aside>
  );
}
