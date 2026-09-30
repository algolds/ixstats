"use client";

import React from "react";
import type { V2Domain } from "./domain-meta";
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

export {
  DomainKpiGrid,
  DomainActivityCard,
  DomainWidget,
  DOMAIN_ACCENT,
  formatCompact,
  timeAgo,
};
export type { Kpi, ActivityEntry };

/**
 * V2DomainContext — the domain-contextual rail for the four full-page domain surfaces.
 * Replaces the shared National Standing / Your Agenda rail with per-domain KPIs and a
 * recent-activity log, so each tab shows information specific to what it manages.
 */
export interface DomainContextRailProps {
  countryId: string;
  domain: V2Domain;
}

export type V2DomainContextProps = DomainContextRailProps;

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
export const V2DomainContext = DomainContextRail;
