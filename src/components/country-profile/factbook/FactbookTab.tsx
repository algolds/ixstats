"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type OpenSheet = { sheet: CountrySheet; segment: EconomySegment };

/**
 * FactbookTab — the country at a glance: Economy & people, State and Foreign affairs as three
 * snapshot blocks, each opening its full detail in a sheet. The open sheet lives in the address
 * (`?sheet=`, `&segment=labor`), so it can be shared, and back closes it.
 */
export function FactbookTab({ layer }: { layer: CountryProfileLayer }) {
  const params = useSearchParams();
  const query = params?.toString() ?? "";
  const [open, setOpen] = useState<OpenSheet | null>(() => parseSheet(params));
  // True while the open sheet was pushed in this visit, so closing it can step back.
  const pushed = useRef(false);

  // The address wins: a <Link> or a restored Back can change the query under the mounted tab.
  useEffect(() => {
    const fromAddress = parseSheet(new URLSearchParams(query));
    // oxlint-disable-next-line
    setOpen((current) => {
      if (current?.sheet === fromAddress?.sheet && current?.segment === fromAddress?.segment)
        return current;
      pushed.current = false;
      return fromAddress;
    });
  }, [query]);

  useEffect(() => {
    const onPopState = () => {
      pushed.current = false;
      setOpen(parseSheet(new URLSearchParams(window.location.search)));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const show = useCallback(
    (sheet: CountrySheet) => {
      setOpen({ sheet, segment: "economy" });
      pushed.current = true;
      window.history.pushState(null, "", withBasePath(countrySheetHref(layer.slug, sheet)));
    },
    [layer.slug]
  );

  const close = useCallback(() => {
    setOpen(null);
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", withBasePath(countryTabHref("factbook", layer.slug)));
    }
  }, [layer.slug]);

  const setSegment = useCallback(
    (segment: EconomySegment) => {
      setOpen({ sheet: "economy", segment });
      window.history.replaceState(
        null,
        "",
        withBasePath(countrySheetHref(layer.slug, "economy", segment))
      );
    },
    [layer.slug]
  );

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
