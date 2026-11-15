"use client";

import Link from "next/link";
import { ArrowUpRight, Bank, Community, Group } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { SheetSection } from "~/components/mycountry/shell/SheetSection";
import { editorHref } from "~/lib/mycountry/routes";
import { api } from "~/trpc/react";
import { GovernmentMetricsEditor } from "./GovernmentMetricsEditor";
import { IDEOLOGY_OPTIONS } from "./ideologies";
import { LegislativeIssues } from "./LegislativeIssues";

const ideologyLabel = (ideology: string) =>
  IDEOLOGY_OPTIONS.find((o) => o.value === ideology)?.label ?? ideology;

export function StateRepresentationPanel({ countryId }: { countryId: string }) {
  const { data: structure } = api.government.getByCountryId.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const structureId = structure?.id;
  const { data: officials = [] } = api.government.getOfficials.useQuery(
    { governmentStructureId: structureId, active: true },
    { enabled: !!structureId }
  );
  const { data: parties = [] } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: legislature } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const departments = structure?.departments ?? [];
  const chamberStructure = legislature?.chamberType.split("|")[0] ?? null;

  return (
    <div className="space-y-4">
      <SheetSection
        title="Cabinet"
        icon={Group}
        accessory={
          <Button asChild variant="outline" size="sm">
            <Link href={editorHref("cabinet")}>
              Configure cabinet
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        {departments.length === 0 ? (
          <EmptyState
            compact
            icon={<Group />}
            title="No cabinet departments configured yet"
            message="Set up your departments and appoint ministers in the editor."
          />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {departments.map((dept) => {
              const deptOfficials = officials.filter((o) => o.departmentId === dept.id);
              const lead = deptOfficials[0];
              return (
                <Card key={dept.id} variant="well" padding="sm" className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-label text-footnote truncate font-medium">
                      {dept.name}
                    </span>
                    {lead ? (
                      <span className="text-label-secondary text-footnote shrink-0 truncate">
                        {lead.name}
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-footnote shrink-0">
                        Vacant
                      </Badge>
                    )}
                  </div>
                  {dept.ministerTitle && (
                    <p className="text-label-secondary text-footnote truncate">
                      {dept.ministerTitle}
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </SheetSection>

      <SheetSection
        title="Political parties"
        icon={Community}
        accessory={
          <Button asChild variant="outline" size="sm">
            <Link href={editorHref("parties")}>
              Configure parties
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        {parties.length === 0 ? (
          <EmptyState
            compact
            icon={<Community />}
            title="No political parties registered yet"
            message="Register parties and set starting electoral support in the editor."
          />
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {parties.map((party) => (
              <Card
                key={party.id}
                variant="well"
                padding="sm"
                className="flex items-center justify-between gap-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="border-separator size-3 shrink-0 rounded-full border"
                    style={{ backgroundColor: party.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-label text-footnote truncate font-medium">{party.name}</p>
                    <p className="text-label-secondary text-footnote truncate">
                      {ideologyLabel(party.ideology)}
                      {party.leaderName ? ` · ${party.leaderName}` : ""}
                    </p>
                  </div>
                </div>
                <span className="text-label text-subhead shrink-0 font-semibold tabular-nums">
                  {party.currentSupport.toFixed(1)}%
                </span>
              </Card>
            ))}
          </div>
        )}
      </SheetSection>

      <SheetSection
        title="Legislature"
        icon={Bank}
        accessory={
          <Button asChild variant="outline" size="sm">
            <Link href={editorHref("legislature")}>
              Configure legislature
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        }
      >
        {!legislature ? (
          <EmptyState
            compact
            icon={<Bank />}
            title={structure?.legislatureName ?? "Legislature not configured yet"}
            message="Define chambers, seat counts and electoral rules in the editor."
          />
        ) : (
          <Card
            variant="well"
            padding="sm"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <p className="text-label text-footnote truncate font-medium">{legislature.name}</p>
              <p className="text-label-secondary text-footnote capitalize">
                {chamberStructure} · {legislature.electoralSystem} · {legislature.termLength}-year
                term
              </p>
            </div>
            <span className="text-label text-subhead shrink-0 font-semibold tabular-nums">
              {legislature.totalSeats} seats
            </span>
          </Card>
        )}
      </SheetSection>

      <GovernmentMetricsEditor countryId={countryId} />
      <LegislativeIssues countryId={countryId} />
    </div>
  );
}
