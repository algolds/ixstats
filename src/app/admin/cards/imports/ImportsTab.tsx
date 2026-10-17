"use client";
/**
 * Imports: the one wiki importer (IxWiki, IIWiki, AltHistory, Commons) with its jobs, and NationStates. The section is
 * in `?subtab=`, read again on back and forward, since the tab stays mounted while only the subtab changes.
 */
import { useEffect, useState } from "react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { ImportJobs } from "./ImportJobs";
import { NsImports } from "./ns";
import { WikiImporter } from "./WikiImporter";

type Section = "wiki" | "nationstates";

const SECTION_OPTIONS: ReadonlyArray<{ value: Section; label: string }> = [
  { value: "wiki", label: "Wikis and Commons" },
  { value: "nationstates", label: "NationStates" },
];

/** The `?subtab=` values, and the `?tab=` values of links with no subtab, that open NationStates. */
const NATIONSTATES_SUBTABS: ReadonlySet<string> = new Set(["nationstates", "ns", "import", "sync"]);
const NATIONSTATES_TABS: ReadonlySet<string> = new Set(["ns", "sync"]);

/** The section the address names; anything else (the old wiki and Commons subtabs too) is the wiki importer. */
function sectionFromAddress(): Section {
  const params = new URLSearchParams(window.location.search);
  const subtab = params.get("subtab");
  const nationstates = subtab
    ? NATIONSTATES_SUBTABS.has(subtab)
    : NATIONSTATES_TABS.has(params.get("tab") ?? "");
  return nationstates ? "nationstates" : "wiki";
}

export function ImportsTab() {
  const [section, setSection] = useState<Section>(sectionFromAddress);

  useEffect(() => {
    const onPopState = () => setSection(sectionFromAddress());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const select = (next: Section) => {
    setSection(next);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", "imports");
    url.searchParams.set("subtab", next);
    window.history.pushState({}, "", url.toString());
  };

  return (
    <div className="space-y-6">
      <SegmentedControl
        asTabs
        aria-label="Import from"
        value={section}
        onValueChange={select}
        options={SECTION_OPTIONS}
      />
      {section === "wiki" ? (
        <>
          <WikiImporter />
          <ImportJobs />
        </>
      ) : (
        <NsImports />
      )}
    </div>
  );
}
