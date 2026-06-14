// src/app/admin/countries/_components/CountryDetailSheet.tsx
// Side sheet showing full country data for admin drill-down
"use client";

import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { ScrollArea } from "~/components/ui/scroll-area";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "~/components/ui/sheet";
import { TrendingUp, Users, DollarSign, Activity, Clock, AlertTriangle, Map } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CountryDetailSheetProps {
  countryId: string | null;
  onClose: () => void;
}

function MetricRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number | null | undefined;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-sm font-medium ${color ?? "text-foreground"}`}>{value ?? "N/A"}</span>
    </div>
  );
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: typeof TrendingUp }) {
  return (
    <div className="border-border/30 mt-4 mb-2 flex items-center gap-2 border-b pb-1">
      <Icon className="text-primary h-4 w-4" />
      <h3 className="text-foreground text-sm font-semibold">{title}</h3>
    </div>
  );
}

function fmt(n: number | null | undefined, prefix = "", suffix = "", decimals = 1): string {
  if (n == null) return "N/A";
  return `${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: decimals })}${suffix}`;
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return "N/A";
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
}

function fmtBig(n: number | null | undefined): string {
  if (n == null) return "N/A";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

export function CountryDetailSheet({ countryId, onClose }: CountryDetailSheetProps) {
  const { data, isLoading } = api.admin.getCountryDetail.useQuery(
    { countryId: countryId! },
    { enabled: !!countryId }
  );

  const country = data?.country;
  const auditLogs = data?.auditLogs ?? [];

  return (
    <Sheet open={!!countryId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg" side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3">
            {country && (
              <>
                <UnifiedCountryFlag countryName={country.name} flagUrl={country.flag} size="md" />
                <span>{country.name}</span>
              </>
            )}
          </SheetTitle>
          <SheetDescription>
            {country
              ? `${country.economicTier ?? "Unknown"} tier - ${country.governmentType ?? "Unknown govt"}`
              : "Loading..."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-120px)] pr-4">
          {isLoading || !country ? (
            <div className="space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Economic */}
              <SectionHeader title="Economy" icon={DollarSign} />
              <MetricRow label="Total GDP" value={fmtBig(country.currentTotalGdp)} />
              <MetricRow
                label="GDP per Capita"
                value={fmt(country.currentGdpPerCapita, "$", "", 0)}
              />
              <MetricRow
                label="GDP Growth"
                value={fmtPct(country.realGDPGrowthRate)}
                color={
                  country.realGDPGrowthRate != null && country.realGDPGrowthRate < 0
                    ? "text-red-500"
                    : "text-green-500"
                }
              />
              <MetricRow label="Inflation" value={fmt(country.inflationRate, "", "%")} />
              <MetricRow label="Debt/GDP" value={fmt(country.totalDebtGDPRatio, "", "%")} />
              <MetricRow label="Economic Tier" value={country.economicTier} />
              <MetricRow label="Economic Vitality" value={fmt(country.economicVitality, "", "")} />

              {/* Population */}
              <SectionHeader title="Demographics" icon={Users} />
              <MetricRow label="Population" value={fmt(country.currentPopulation, "", "", 0)} />
              <MetricRow label="Pop. Growth" value={fmtPct(country.populationGrowthRate)} />
              <MetricRow label="Life Expectancy" value={fmt(country.lifeExpectancy, "", " yrs")} />
              <MetricRow
                label="Urbanization"
                value={fmt(country.urbanPopulationPercent, "", "%")}
              />
              <MetricRow label="Literacy" value={fmt(country.literacyRate, "", "%")} />

              {/* Governance */}
              <SectionHeader title="Governance" icon={Activity} />
              <MetricRow label="Government Type" value={country.governmentType} />
              <MetricRow label="Political Stability" value={country.politicalStability} />
              <MetricRow label="Public Approval" value={fmt(country.publicApproval, "", "%")} />
              <MetricRow
                label="National Health"
                value={fmt(country.overallNationalHealth, "", "")}
              />
              <MetricRow label="Leader" value={country.leader} />

              {/* Map Linkage (live check against MapLayer) */}
              <SectionHeader title="Map Linkage" icon={Map} />
              <MapLinkageSection
                countryId={country.id}
                landArea={country.landArea}
                areaSqMi={country.areaSqMi}
              />

              {/* Owner */}
              <SectionHeader title="Owner" icon={Users} />
              {country.users.length > 0 ? (
                country.users.map((u) => (
                  <div key={u.id} className="border-border/30 rounded-lg border p-2">
                    <MetricRow label="Clerk ID" value={u.clerkUserId} />
                    <MetricRow label="Tier" value={u.membershipTier} />
                    <MetricRow
                      label="Last Active"
                      value={formatDistanceToNow(new Date(u.updatedAt), { addSuffix: true })}
                    />
                    <MetricRow
                      label="Status"
                      value={u.isActive ? "Active" : "Inactive"}
                      color={u.isActive ? "text-green-500" : "text-red-500"}
                    />
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground py-2 text-xs">No owner assigned</p>
              )}

              {/* Active Interventions */}
              {country.storytellerEffects.length > 0 && (
                <>
                  <SectionHeader title="Active Interventions" icon={AlertTriangle} />
                  {country.storytellerEffects.map((dm) => (
                    <div
                      key={dm.id}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2"
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {dm.inputType}
                        </Badge>
                        <span className="font-mono text-xs font-medium">
                          {dm.value >= 0 ? "+" : ""}
                          {(dm.value * 100).toFixed(1)}%
                        </span>
                      </div>
                      {dm.description && (
                        <p className="text-muted-foreground mt-1 text-xs">{dm.description}</p>
                      )}
                      <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(dm.createdAt), { addSuffix: true })}
                        {dm.duration && <span> - {dm.duration}yr duration</span>}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Audit Log */}
              {auditLogs.length > 0 && (
                <>
                  <SectionHeader title="Recent Admin Actions" icon={Clock} />
                  {auditLogs.map((log) => (
                    <div key={log.id} className="border-border/20 border-b py-2">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs">
                          {log.action}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs">by {log.adminName}</p>
                    </div>
                  ))}
                </>
              )}

              {/* Timestamps */}
              <SectionHeader title="Metadata" icon={Clock} />
              <MetricRow
                label="Last Calculated"
                value={
                  country.lastCalculated
                    ? formatDistanceToNow(new Date(country.lastCalculated), { addSuffix: true })
                    : "Never"
                }
              />
              <MetricRow label="Created" value={new Date(country.createdAt).toLocaleDateString()} />
              <MetricRow label="Updated" value={new Date(country.updatedAt).toLocaleDateString()} />
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/** Live linkage check against the MapLayer table */
function MapLinkageSection({
  countryId,
  landArea,
  // eslint-disable-next-line unused-imports/no-unused-vars
  areaSqMi,
}: {
  countryId: string;
  landArea: number | null | undefined;
  areaSqMi: number | null | undefined;
}) {
  const { data: linkage, isLoading } = api.geoCore.getCountryLinkage.useQuery(
    { countryId },
    { staleTime: 10_000 }
  );

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }

  const linked = linkage?.isLinked ?? false;
  const desync = linked && !landArea;

  return (
    <>
      <MetricRow
        label="Map Feature"
        value={linked ? (linkage?.featureName ?? linkage?.featureId) : "Not linked"}
        color={linked ? "text-emerald-500" : "text-amber-500"}
      />
      <MetricRow
        label="Link Status"
        value={linked ? "Linked" : "No MapLayer link"}
        color={linked ? "text-emerald-500" : "text-red-500"}
      />
      {linked && (
        <MetricRow
          label="Feature Area"
          value={linkage?.areaSqKm ? `${Math.round(linkage.areaSqKm).toLocaleString()} km²` : "—"}
        />
      )}
      <MetricRow
        label="Country.landArea"
        value={landArea ? `${Math.round(landArea).toLocaleString()} km²` : "null"}
        color={desync ? "text-red-500" : undefined}
      />
      {!linked && landArea && landArea > 0 && (
        <div className="mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          Country has landArea but no MapLayer link. Use Map Admin → Linkage tab to repair.
        </div>
      )}
      {desync && (
        <div className="mt-1 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-400">
          MapLayer linked but Country.landArea is null. Run "Sync All" from Map Admin → Linkage.
        </div>
      )}
    </>
  );
}
