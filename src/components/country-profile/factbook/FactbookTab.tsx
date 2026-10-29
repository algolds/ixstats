"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CountryProfileLayer } from "~/app/countries/[slug]/_hooks/useCountryProfileLayer";
import { withBasePath } from "~/lib/base-path";
import {
  countrySheetHref,
  countryTabHref,
  parseSheet,
  type CountrySheet,
  type EconomySegment,
} from "~/lib/country/country-routes";
import { EconomyBlock, ForeignBlock, StateBlock } from "./Blocks";
import { FactbookSheets } from "./FactbookSheets";

/** The open sheet, and whether this visit pushed it (so closing it can step back). */
type OpenSheet = { sheet: CountrySheet; segment: EconomySegment; pushed: boolean } | null;

/** The sheet a query string names, as not pushed by this visit. */
function sheetAt(search: string): OpenSheet {
  const sheet = parseSheet(new URLSearchParams(search));
  return sheet && { ...sheet, pushed: false };
}

/**
 * FactbookTab — the country at a glance: Economy & people, State and Foreign affairs as three
 * snapshot blocks, each opening its full detail in a sheet. The open sheet lives in the address
 * (`?sheet=`, `&segment=labor`), so it can be shared, and back closes it.
 */
export function FactbookTab({ layer }: { layer: CountryProfileLayer }) {
  const params = useSearchParams();
  const query = params?.toString() ?? "";
  const [open, setOpen] = useState<OpenSheet>(() => sheetAt(query));

  // The address wins: a <Link> or a restored Back can change the query under the mounted tab.
  const [syncedQuery, setSyncedQuery] = useState(query);
  if (query !== syncedQuery) {
    setSyncedQuery(query);
    const fromAddress = sheetAt(query);
    if (open?.sheet !== fromAddress?.sheet || open?.segment !== fromAddress?.segment) {
      setOpen(fromAddress);
    }
  }

  useEffect(() => {
    const onPopState = () => setOpen(sheetAt(window.location.search));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const show = (sheet: CountrySheet) => {
    setOpen({ sheet, segment: "economy", pushed: true });
    window.history.pushState(null, "", withBasePath(countrySheetHref(layer.slug, sheet)));
  };

  const close = () => {
    setOpen(null);
    if (open?.pushed) {
      window.history.back();
    } else {
      window.history.replaceState(null, "", withBasePath(countryTabHref("factbook", layer.slug)));
    }
  };

  const setSegment = (segment: EconomySegment) => {
    setOpen((current) => ({ sheet: "economy", segment, pushed: current?.pushed ?? false }));
    window.history.replaceState(
      null,
      "",
      withBasePath(countrySheetHref(layer.slug, "economy", segment))
    );
  };

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <EconomyBlock layer={layer} onMore={() => show("economy")} />
        <StateBlock layer={layer} onMore={() => show("state")} />
        <ForeignBlock layer={layer} onMore={() => show("foreign")} />
      </div>
      <FactbookSheets layer={layer} open={open} onClose={close} onSegment={setSegment} />
    </>
  );
}
