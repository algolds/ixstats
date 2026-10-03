"use client";

import React from "react";
import type { MyCountryDomain } from "./domain-meta";
import {
  RelationsRail,
  DefenseRail,
  PoliticsRail,
  EconomyRail,
  DomainKpiGrid,
  DomainActivityCard,
  DomainWidget,
  DOMAIN_ACCENT,
  type Kpi,
  type ActivityEntry,
} from "./rails";
import { formatCompact, timeAgo } from "~/lib/format/compact";

export { DomainKpiGrid, DomainActivityCard, DomainWidget, DOMAIN_ACCENT, formatCompact, timeAgo };
export type { Kpi, ActivityEntry };

/** The rail for the four full-page domain surfaces: per-domain KPIs and a recent-activity log. */
export interface DomainContextRailProps {
  countryId: string;
  domain: MyCountryDomain;
}

function DomainContextRailComponent({
  countryId,
  domain,
}: DomainContextRailProps): React.JSX.Element {
  switch (domain) {
    case "relations":
      return <RelationsRail countryId={countryId} />;
    case "defense":
      return <DefenseRail countryId={countryId} />;
    case "politics":
      return <PoliticsRail countryId={countryId} />;
    case "economy":
      return <EconomyRail countryId={countryId} />;
  }
}

export const DomainContextRail = React.memo(DomainContextRailComponent);
