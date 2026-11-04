"use client";

import { useState } from "react";
import { Building, GraphUp, Lock, Wallet } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { PageHeader } from "~/components/shell/PageHeader";
import { Button } from "~/components/ui/button";
import { Card, CardTitle } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { CompaniesCard } from "./CompaniesCard";
import { CompanyInspector } from "./CompanyInspector";
import { ContractsCard } from "./ContractsCard";
import { GovernanceCard } from "./GovernanceCard";
import { SectorsCard } from "./SectorsCard";
import { SharesCard } from "./SharesCard";
import { SovereignWalletCard } from "./SovereignWalletCard";
import {
  CreditRatingBadge,
  formatSovereigns,
  sectorLabel,
  subIndustryLabel,
} from "./shared";

type Overview = RouterOutputs["exchange"]["getOverview"];
type Company = Overview["companies"][number];
type ExchangeTab = "overview" | "companies" | "orderbook" | "contracts" | "governance";

function CompanyDirectory({
  rows,
  selectedCompanyId,
  onSelectCompany,
}: {
  rows: ReadonlyArray<Company>;
  selectedCompanyId: string;
  onSelectCompany: (companyId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <Card padding="lg" className="space-y-3">
      <CardTitle icon={<GraphUp />}>Leading companies</CardTitle>
      <ol className="space-y-2">
        {rows.slice(0, 10).map((c, i) => (
          <li
            key={c.id}
            className="text-footnote flex items-center justify-between gap-3"
          >
            <button
              type="button"
              onClick={() => onSelectCompany(c.id)}
              className="text-label hover:text-tint flex min-w-0 items-center gap-2 truncate text-left"
            >
              <span className="text-label-secondary tabular-nums">{i + 1}.</span>
              <span className={c.id === selectedCompanyId ? "font-semibold" : "font-medium"}>
                {c.name}
              </span>
              <span className="text-label-secondary truncate">
                {subIndustryLabel(c.subIndustryKey)} · {sectorLabel(c.sectorKey)}
              </span>
            </button>
            <span className="flex shrink-0 items-center gap-2">
              <CreditRatingBadge rating={c.creditRating} />
              <span className="text-label font-medium tabular-nums">
                {formatSovereigns(c.fairValue)}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function ExchangeKpiStrip({
  overview,
  sectorPortfolioValue,
  directoryCount,
}: {
  overview: Overview;
  sectorPortfolioValue: number;
  directoryCount: number;
}) {
  const myNation = overview.nations.find((n) => n.realmId === overview.realmId);
  const treasury = api.exchange.getTreasury.useQuery(
    { countryId: myNation?.id ?? "" },
    { enabled: Boolean(myNation) }
  );

  const holdingsValue = overview.holdings.reduce((s, h) => s + h.fairValue, 0);
  const totalPortfolio = Math.round((holdingsValue + sectorPortfolioValue) * 100) / 100;
  const activeCount = overview.companies.filter(
    (c) => c.status === "ACTIVE" || c.status === "DISTRESSED"
  ).length;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Card padding="sm">
        <Stat
          size="sm"
          label="Wallet balance"
          value={formatSovereigns(overview.wallet.sovereigns)}
          hint={`Earned ${formatSovereigns(overview.wallet.lifetimeEarned)} · spent ${formatSovereigns(overview.wallet.lifetimeSpent)}`}
        />
      </Card>
      <Card padding="sm">
        <Stat
          size="sm"
          label="Share and sector portfolio"
          value={formatSovereigns(totalPortfolio)}
          hint={`Shares ${formatSovereigns(holdingsValue)} · sector funds ${formatSovereigns(sectorPortfolioValue)}`}
        />
      </Card>
      <Card padding="sm">
        <Stat
          size="sm"
          label="Active companies and bids"
          value={`${activeCount} / ${overview.companyRules.activeCompanyCap}`}
          hint={`${overview.buyOrders.length} resting buy ${overview.buyOrders.length === 1 ? "order" : "orders"}`}
        />
      </Card>
      <Card padding="sm">
        {myNation && treasury.data ? (
          <Stat
            size="sm"
            label={`${myNation.name} treasury`}
            value={formatSovereigns(treasury.data.balance)}
            hint={`Cap ${formatSovereigns(treasury.data.cap)} · stipend ${formatSovereigns(treasury.data.dailyStipend)}/day`}
          />
        ) : (
          <Stat
            size="sm"
            label="Realm corporate directory"
            value={directoryCount.toLocaleString("en-US")}
            hint={`${overview.realmNations.length} domicile ${overview.realmNations.length === 1 ? "nation" : "nations"} in realm`}
          />
        )}
      </Card>
    </div>
  );
}

/**
 * The Exchange: the Sovereign (₷) wallet, companies, order book, contracts and governance.
 */
export function ExchangeSection() {
  const utils = api.useUtils();
  const [workspace, setWorkspace] = useState({
    realmId: "default",
    tab: "overview" as ExchangeTab,
    selectedCompanyId: "",
  });
  const { realmId, tab, selectedCompanyId } = workspace;

  const overview = api.exchange.getOverview.useQuery({ realmId });
  const directory = api.exchange.listCompanies.useQuery({ realmId });
  const sectors = api.exchange.getSectors.useQuery({ realmId });

  const refresh = () => {
    void utils.exchange.getOverview.invalidate();
    void utils.exchange.listCompanies.invalidate();
    void utils.exchange.getShareMarket.invalidate();
    void utils.exchange.getSectors.invalidate();
  };

  const directoryRows = directory.data ?? [];
  const allCompanies: Company[] = overview.data
    ? [
        ...overview.data.companies,
        ...directoryRows.filter((d) => !overview.data.companies.some((c) => c.id === d.id)),
      ]
    : [];
  const inspectedCompany =
    allCompanies.find((c) => c.id === selectedCompanyId) ??
    overview.data?.companies[0] ??
    directoryRows[0] ??
    null;
  const inspectedSectorValue =
    sectors.data?.find((s) => s.sectorKey === inspectedCompany?.sectorKey)?.value ?? 1000;
  const sectorPortfolioValue = (sectors.data ?? []).reduce(
    (s, sec) => s + (sec.position?.value ?? 0),
    0
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exchange"
        subtitle="Sovereigns, companies, two-sided order books, nation treasuries and shareholder governance."
        actions={
          overview.data ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-44">
                <Select
                  value={realmId}
                  onValueChange={(nextRealmId) =>
                    setWorkspace({
                      ...workspace,
                      realmId: nextRealmId,
                      selectedCompanyId: "",
                    })
                  }
                >
                  <SelectTrigger size="sm" aria-label="Realm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {overview.data.realms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-footnote text-label inline-flex items-center gap-1.5 px-2 font-medium tabular-nums">
                <Wallet className="size-4" aria-hidden />
                {formatSovereigns(overview.data.wallet.sovereigns)}
              </span>
              <Button
                size="sm"
                onClick={() => setWorkspace({ ...workspace, tab: "companies" })}
              >
                <Building aria-hidden />
                Charter a company
              </Button>
            </div>
          ) : null
        }
      />

      {overview.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !overview.data ? (
        <EmptyState
          title="The Exchange didn't load"
          message={overview.error?.message ?? "Try again in a moment."}
        />
      ) : (
        <>
          {!overview.data.isOpen && (
            <EmptyState
              compact
              icon={<Lock />}
              title="The Exchange is closed right now"
              message="Your balance and companies are safe. Trading reopens when an admin turns it back on."
            />
          )}

          <ExchangeKpiStrip
            overview={overview.data}
            sectorPortfolioValue={sectorPortfolioValue}
            directoryCount={directoryRows.length}
          />

          <div className="flex flex-col items-start gap-6 lg:flex-row">
            <div className="min-w-0 flex-1 w-full">
              <Tabs
                value={tab}
                onValueChange={(nextTab) =>
                  setWorkspace({ ...workspace, tab: nextTab as ExchangeTab })
                }
                className="space-y-4"
              >
                <TabsList className="flex-wrap gap-1">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="companies">Companies</TabsTrigger>
                  <TabsTrigger value="orderbook">Order book</TabsTrigger>
                  <TabsTrigger value="contracts">Contracts</TabsTrigger>
                  <TabsTrigger value="governance">Governance</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                  <div className="grid gap-6 lg:grid-cols-2">
                    <SovereignWalletCard overview={overview.data} />
                    <CompanyDirectory
                      rows={directoryRows}
                      selectedCompanyId={inspectedCompany?.id ?? ""}
                      onSelectCompany={(companyId) =>
                        setWorkspace({ ...workspace, selectedCompanyId: companyId })
                      }
                    />
                  </div>
                  <SectorsCard
                    realmId={overview.data.realmId}
                    isOpen={overview.data.isOpen}
                    onChanged={refresh}
                  />
                </TabsContent>

                <TabsContent value="companies" className="space-y-6">
                  <CompaniesCard
                    overview={overview.data}
                    directoryCompanies={directoryRows}
                    onSelectCompany={(companyId) =>
                      setWorkspace({ ...workspace, selectedCompanyId: companyId })
                    }
                    onChanged={refresh}
                  />
                </TabsContent>

                <TabsContent value="orderbook" className="space-y-6">
                  <SharesCard
                    overview={overview.data}
                    directoryCompanies={directoryRows}
                    selectedCompanyId={inspectedCompany?.id}
                    onSelectCompany={(companyId) =>
                      setWorkspace({ ...workspace, selectedCompanyId: companyId })
                    }
                    onChanged={refresh}
                  />
                </TabsContent>

                <TabsContent value="contracts" className="space-y-6">
                  <ContractsCard overview={overview.data} onChanged={refresh} />
                </TabsContent>

                <TabsContent value="governance" className="space-y-6">
                  <GovernanceCard
                    overview={overview.data}
                    directoryCompanies={directoryRows}
                    selectedCompanyId={inspectedCompany?.id}
                    onSelectCompany={(companyId) =>
                      setWorkspace({ ...workspace, selectedCompanyId: companyId })
                    }
                    onChanged={refresh}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {inspectedCompany && (
              <CompanyInspector
                company={inspectedCompany}
                companies={allCompanies}
                realmNations={overview.data.realmNations}
                sectorIndexValue={inspectedSectorValue}
                onSelectCompany={(companyId) =>
                  setWorkspace({ ...workspace, selectedCompanyId: companyId })
                }
                onJumpTab={(nextTab) =>
                  setWorkspace({
                    ...workspace,
                    tab: nextTab,
                    selectedCompanyId: inspectedCompany.id,
                  })
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
