"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Badge } from "~/components/ui/badge";
import { FileText, Folder } from "lucide-react";

interface CategoryMember {
  title: string;
  ns: number;
}

interface DomainPortalProps {
  domain: string;
  domainMeta: { color: string; metric: string; description: string };
  subcategories: CategoryMember[];
  pages: CategoryMember[];
}

// Maps domain names to wiki article title patterns for dynamic linking
// e.g., "Government" + "Urcea" → "Government of Urcea"
const DOMAIN_ARTICLE_PATTERNS: Record<string, string[]> = {
  Government: ["Government of", "Politics of"],
  Economy: ["Economy of"],
  Military: ["Military of", "Armed Forces of"],
  Politics: ["Politics of", "Elections in"],
  History: ["History of"],
  Geography: ["Geography of"],
  Culture: ["Culture of", "Culture in"],
  Technology: ["Technology in"],
  People: ["Demographics of"],
  Nature: ["Wildlife of", "Environment of"],
};

export function DomainPortal({ domain, domainMeta, subcategories, pages }: DomainPortalProps) {
  const { data: countriesData } = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { staleTime: 10 * 60 * 1000 }
  );

  const countries = useMemo(() => {
    const list = Array.isArray(countriesData)
      ? countriesData
      : ((countriesData as any)?.countries ?? []);
    return [...list].sort((a: any, b: any) => (a.name ?? "").localeCompare(b.name ?? ""));
  }, [countriesData]);

  // Build a set of page titles for quick lookup
  const pageTitleSet = useMemo(() => new Set(pages.map((p) => p.title.toLowerCase())), [pages]);

  // For each country, find the best domain-specific article link
  const getCountryDomainLink = (countryName: string): string => {
    const patterns = DOMAIN_ARTICLE_PATTERNS[domain] ?? [];
    for (const pattern of patterns) {
      const candidate = `${pattern} ${countryName}`;
      // Check if this article exists in the category's page members
      if (pageTitleSet.has(candidate.toLowerCase())) {
        return `/w/${encodeURIComponent(candidate.replace(/ /g, "_"))}`;
      }
    }
    // Fallback: try "Domain of Country" even if not in member list (likely exists on wiki)
    if (patterns.length > 0) {
      return `/w/${encodeURIComponent(`${patterns[0]} ${countryName}`.replace(/ /g, "_"))}`;
    }
    // Last resort: link to country article
    return `/w/${encodeURIComponent(countryName.replace(/ /g, "_"))}`;
  };

  return (
    <div className="wikios-portal">
      {/* Domain header */}
      <div className="wikios-domain-header" style={{ borderColor: domainMeta.color }}>
        <h1 className="wikios-domain-title">{domain}</h1>
        <p className="wikios-domain-desc">{domainMeta.description}</p>
        <div className="mt-2 flex gap-2">
          <Badge variant="outline" className="text-[10px]">
            {pages.length} articles
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {subcategories.length} subcategories
          </Badge>
        </div>
      </div>

      {/* Subcategories as pills */}
      {subcategories.length > 0 && (
        <div className="wikios-portal-section">
          <h2 className="wikios-portal-section-title">Subcategories</h2>
          <div className="wikios-portal-subcats">
            {subcategories.map((m) => {
              const name = m.title.replace(/^Category:/, "");
              return (
                <Link
                  key={m.title}
                  href={withBasePath(
                    `/w/special/categories/${encodeURIComponent(name.replace(/ /g, "_"))}`
                  )}
                  className="wikios-portal-pill"
                >
                  <Folder className="h-3 w-3 opacity-50" />
                  {name}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* All wiki articles in this category */}
      {pages.length > 0 && (
        <div className="wikios-portal-section">
          <h2 className="wikios-portal-section-title">Articles ({pages.length})</h2>
          <div className="wikios-portal-articles">
            {pages.map((m) => {
              const countryMatch = countries.find((c: any) =>
                m.title.toLowerCase().includes((c.name ?? "").toLowerCase())
              ) as any;
              return (
                <Link
                  key={m.title}
                  href={withBasePath(`/w/${encodeURIComponent(m.title.replace(/ /g, "_"))}`)}
                  className="wikios-portal-card"
                >
                  {countryMatch?.flagUrl ? (
                    <img
                      src={countryMatch.flagUrl}
                      alt=""
                      className="wikios-portal-card-flag"
                      loading="lazy"
                    />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-40" />
                  )}
                  <span className="wikios-portal-card-title">{m.title}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Nations — compact grid with domain-specific links */}
      {countries.length > 0 && (
        <CollapsibleNationGrid
          countries={countries}
          domain={domain}
          getCountryDomainLink={getCountryDomainLink}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible nation grid — shows ~12 initially, expand to see all
// ---------------------------------------------------------------------------

const INITIAL_COUNT = 12;

function CollapsibleNationGrid({
  countries,
  domain,
  getCountryDomainLink,
}: {
  countries: any[];
  domain: string;
  getCountryDomainLink: (name: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? countries : countries.slice(0, INITIAL_COUNT);
  const hasMore = countries.length > INITIAL_COUNT;

  return (
    <div className="wikios-portal-section">
      <h2 className="wikios-portal-section-title">
        Browse by nation
        <span className="wikios-portal-section-count">{countries.length}</span>
      </h2>
      <div className="wikios-domain-countries">
        {visible.map((c: any) => (
          <Link
            key={c.id}
            href={withBasePath(getCountryDomainLink(c.name ?? ""))}
            className="wikios-domain-country-card glass-hierarchy-child"
            title={`${domain} of ${c.name}`}
          >
            {c.flagUrl && (
              <img src={c.flagUrl} alt="" className="wikios-domain-country-flag" loading="lazy" />
            )}
            <div className="wikios-domain-country-info">
              <span className="wikios-domain-country-name">{c.name}</span>
              {c.economicTier && (
                <span className="wikios-domain-country-tier">{c.economicTier}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
      {hasMore && (
        <button onClick={() => setExpanded(!expanded)} className="wikios-portal-expand">
          {expanded ? "Show less" : `See all ${countries.length} nations`}
        </button>
      )}
    </div>
  );
}
