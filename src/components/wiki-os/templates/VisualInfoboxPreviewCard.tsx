"use client";

import React, { useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";

type InfoboxParam = {
  name: string;
  label?: string;
  example?: string;
  type?: string;
  variantOnly?: string[];
};

interface VisualInfoboxPreviewCardProps {
  templateName: string;
  variantId?: string;
  variantLabel?: string;
  params: InfoboxParam[];
  customValues?: Record<string, string>;
  className?: string;
}

// Title / image fields render in the header / image slot, not as table rows
const HEADER_FIELDS = new Set([
  "name",
  "title",
  "official_name",
  "native_name",
  "image",
  "image_flag",
  "image_coat",
  "image_seal",
  "image_skyline",
]);

/** First matching rule wins; params matching none land in "general". */
const SECTION_RULES: ReadonlyArray<[id: string, keywords: string[]]> = [
  ["geography", ["capital", "largest_city", "coordinates", "location", "area", "elevation"]],
  [
    "governance",
    [
      "leader",
      "government",
      "monarch",
      "president",
      "prime_minister",
      "legislature",
      "party",
      "office",
    ],
  ],
  ["demographics", ["population", "demonym", "language", "religion", "ethnic"]],
  ["economy", ["gdp", "currency", "hdi", "revenue", "assets", "headquarters"]],
  ["military", ["commander", "branch", "battles", "armament", "speed", "displacement", "range"]],
  ["historical", ["established", "dissolved", "predecessor", "successor", "date", "born", "died"]],
  ["technical", ["manufacturer", "designer", "caliber", "weight", "length"]],
];

/** Display order and titles of the authentic MediaWiki infobox sections. */
const SECTION_TITLES: ReadonlyArray<[id: string, title: string]> = [
  ["historical", "Historical timeline"],
  ["governance", "Government & politics"],
  ["demographics", "Demographics & society"],
  ["geography", "Geography & territories"],
  ["economy", "Economy & currency"],
  ["military", "Military & service"],
  ["technical", "Technical specifications"],
  ["general", "General information"],
];

function groupInfoboxParams(params: InfoboxParam[]) {
  const byId = new Map<string, InfoboxParam[]>();
  for (const p of params) {
    const n = p.name.toLowerCase();
    if (HEADER_FIELDS.has(n)) continue;
    const id =
      SECTION_RULES.find(([, keywords]) => keywords.some((k) => n.includes(k)))?.[0] ?? "general";
    byId.set(id, [...(byId.get(id) ?? []), p]);
  }

  const sections = SECTION_TITLES.flatMap(([id, title]) =>
    byId.has(id) ? [{ id, title, items: byId.get(id)! }] : []
  );
  if (sections.length === 0 && params.length > 0) {
    sections.push({ id: "all", title: "Entity details", items: params });
  }
  return sections;
}

function ImageTile({
  label,
  labelClass,
  value,
  className,
}: {
  label: string;
  labelClass: string;
  value: string;
  className: string;
}) {
  return (
    <div
      className={cn(
        "border-separator bg-surface rounded-row flex flex-col items-center justify-center border",
        className
      )}
    >
      <span className={`text-label-secondary ${labelClass}`}>{label}</span>
      <span className="text-label-secondary text-footnote mt-1 tabular-nums">{value}</span>
    </div>
  );
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

  const groupedSections = useMemo(
    () =>
      groupInfoboxParams(
        params.filter(
          (p) => !p.variantOnly?.length || !variantId || p.variantOnly.includes(variantId)
        )
      ),
    [params, variantId]
  );

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

  const isCountryOrPlace = /country|settlement|city/i.test(cleanName);

  return (
    <motion.aside
      key={`${cleanName}-${variantId || "default"}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
      className={cn(
        "wikios-infobox border-separator bg-surface rounded-card shadow-floating w-[330px] max-w-[340px] shrink-0 overflow-hidden border text-[13px] leading-[1.4] select-text",
        className
      )}
      style={{ float: "none", margin: 0 }}
    >
      <table className="infobox w-full table-fixed border-collapse">
        <tbody>
          <tr>
            <th
              colSpan={2}
              className="infobox-above font-brand border-separator bg-tint/10 text-label text-title-3 border-b px-4 py-3 text-center"
            >
              <div className="">{title}</div>
              {subheader && (
                <div className="infobox-subheader text-label-secondary text-footnote mt-0.5 font-normal italic">
                  {subheader}
                </div>
              )}
            </th>
          </tr>

          {/* Media / crest / flag plinth */}
          <tr>
            <td
              colSpan={2}
              className="infobox-image border-separator bg-fill-4 border-b p-3 text-center"
            >
              {isCountryOrPlace ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <ImageTile
                      label="National flag"
                      labelClass="text-subhead"
                      value={customValues.image_flag || "Flag.svg"}
                      className="h-20 p-2"
                    />
                    <ImageTile
                      label="Coat of arms"
                      labelClass="text-eyebrow"
                      value={customValues.image_coat || "Crest.svg"}
                      className="h-20 p-2"
                    />
                  </div>
                  {motto && (
                    <div className="text-label-secondary text-footnote mt-2 font-serif italic">
                      &ldquo;{motto}&rdquo;
                    </div>
                  )}
                </>
              ) : (
                <ImageTile
                  label="Primary entity image"
                  labelClass="text-subhead"
                  value={customValues.image || `${cleanName.replace(/\s+/g, "_")}.jpg`}
                  className="h-24 p-4"
                />
              )}
            </td>
          </tr>

          {anthem && (
            <tr>
              <th
                scope="row"
                className="infobox-label text-label-secondary border-separator text-caption w-[38%] border-b px-3 py-2 text-right"
              >
                Anthem
              </th>
              <td className="infobox-data text-label border-separator text-footnote border-b px-3 py-2 font-normal">
                {anthem}
              </td>
            </tr>
          )}

          {groupedSections.map((sec) => (
            <React.Fragment key={sec.id}>
              <tr>
                <th
                  colSpan={2}
                  className="infobox-header text-label border-separator bg-fill-4 text-eyebrow border-t border-b px-3 py-2 text-center"
                >
                  {sec.title}
                </th>
              </tr>

              {sec.items.map((p) => (
                <tr key={p.name} className="hover:bg-fill-4 transition-colors">
                  <th
                    scope="row"
                    className="infobox-label text-label-secondary border-separator text-caption w-[38%] border-b px-3 py-2 text-right align-top break-words"
                  >
                    {p.label || p.name.replace(/_/g, " ")}
                  </th>
                  <td className="infobox-data text-label border-separator text-footnote border-b px-3 py-2 align-top font-normal break-words">
                    {customValues[p.name] || p.example || p.label || p.name.replace(/_/g, " ")}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </motion.aside>
  );
}
