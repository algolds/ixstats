"use client";

import { useState } from "react";
import Link from "next/link";
import { BookStack } from "iconoir-react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { assetUrl } from "~/lib/base-path";
import {
  Field,
  SectorSelect,
  SubIndustrySelect,
  formatSovereigns,
  subIndustriesOf,
  subIndustryLabel,
  useRequestId,
  type CompanyWikiData,
  type Sector,
  type SubIndustryKey,
} from "./shared";

type Overview = RouterOutputs["exchange"]["getOverview"];
type WikiPreview = RouterOutputs["exchange"]["previewWikiCompany"];

export function WikiLoreBanner({
  wikiData,
  wikiSlug,
}: {
  wikiData: CompanyWikiData | null;
  wikiSlug?: string | null;
}) {
  const slug = wikiData?.wikiSlug ?? wikiSlug ?? null;
  if (!slug && !wikiData) return null;
  return (
    <Card variant="well" padding="sm" className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {wikiData?.logoUrl && (
            <img
              src={assetUrl(wikiData.logoUrl) ?? undefined}
              alt={`${wikiData.pageTitle} logo`}
              className="border-separator bg-surface-secondary size-7 rounded border object-contain p-0.5"
            />
          )}
          <div>
            {slug && (
              <Link
                href={`/wiki/${encodeURIComponent(slug)}`}
                className="text-caption text-tint-ink inline-flex items-center gap-1 font-medium hover:underline"
              >
                <BookStack className="size-3.5" aria-hidden />
                WikiOS: {slug.replace(/_/g, " ")}
              </Link>
            )}
            {wikiData?.motto && (
              <p className="text-caption text-label-secondary italic">“{wikiData.motto}”</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {wikiData?.foundedText && (
            <Badge variant="outline">Founded: {wikiData.foundedText}</Badge>
          )}
          {wikiData?.keyPeople && <Badge variant="outline">Leadership: {wikiData.keyPeople}</Badge>}
          {wikiData?.products && <Badge variant="outline">Products: {wikiData.products}</Badge>}
        </div>
      </div>
      {wikiData?.summary && (
        <p className="text-caption text-label-secondary line-clamp-2">{wikiData.summary}</p>
      )}
    </Card>
  );
}

/** Sheet overlay to charter a new company or import one from WikiOS. */
export function FoundCompanySheet({
  open,
  onOpenChange,
  overview,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: Overview;
  onDone: () => void;
}) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [form, setForm] = useState({
    name: "",
    sector: "services" as Sector,
    subIndustryKey: "finance_insurance" as SubIndustryKey,
    hqCountryId: overview.nations.find((n) => n.realmId === overview.realmId)?.id ?? "none",
    wikiInput: "",
  });
  const [wikiPreview, setWikiPreview] = useState<WikiPreview | null>(null);
  const [fetchingWiki, setFetchingWiki] = useState(false);
  const [requestId, rotate] = useRequestId();
  const found = api.exchange.foundCompany.useMutation({
    onSuccess: ({ company }) => {
      notify.success("Company chartered", `${company.name} is open for business`);
      setForm((prev) => ({ ...prev, name: "", wikiInput: "" }));
      setWikiPreview(null);
      rotate();
      onOpenChange(false);
      onDone();
    },
    onError: (e) => notify.error("Could not charter the company", e.message),
  });
  const active = overview.companies.filter(
    (c) => c.status === "ACTIVE" || c.status === "DISTRESSED"
  ).length;
  const atCap = active >= overview.companyRules.activeCompanyCap;

  const handleImportWiki = async () => {
    const title = form.wikiInput.trim() || form.name.trim();
    if (!title) return;
    setFetchingWiki(true);
    try {
      const preview = await utils.exchange.previewWikiCompany.fetch({
        wikiTitle: title,
        realmId: overview.realmId,
      });
      setWikiPreview(preview);
      setForm((prev) => ({
        ...prev,
        name: preview.companyName.slice(0, 60),
        sector: preview.sectorKey as Sector,
        subIndustryKey: preview.subIndustryKey,
        hqCountryId: preview.hqCountryId ?? prev.hqCountryId,
        wikiInput: preview.wikiSlug,
      }));
      notify.success(
        "Imported from WikiOS",
        `Loaded ${preview.pageTitle} (${subIndustryLabel(preview.subIndustryKey)})`
      );
    } catch (err) {
      notify.error(
        "Could not import from WikiOS",
        err instanceof Error ? err.message : "WikiOS article not found"
      );
    }
    // After, not in a finally: the catch never rethrows, and the React Compiler skips finally.
    setFetchingWiki(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Charter a company</SheetTitle>
          <SheetDescription>
            {active} of {overview.companyRules.activeCompanyCap} active companies · Charter fee{" "}
            {formatSovereigns(overview.companyRules.charterFee)}
          </SheetDescription>
        </SheetHeader>
        <form
          className="space-y-4 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            found.mutate({
              name: form.name,
              sectorKey: form.sector,
              subIndustryKey: form.subIndustryKey,
              hqCountryId: form.hqCountryId === "none" ? null : form.hqCountryId,
              wikiSlug: wikiPreview?.wikiSlug ?? (form.wikiInput.trim() || null),
              realmId: overview.realmId,
              requestId,
            });
          }}
        >
          <Card variant="well" padding="sm" className="space-y-2">
            <p className="text-caption text-label-secondary">
              Optional: prefill company name, sector, HQ, and lore from a WikiOS article.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-44 flex-1">
                <Input
                  aria-label="WikiOS article title or URL"
                  value={form.wikiInput}
                  onChange={(e) => setForm({ ...form, wikiInput: e.target.value })}
                  placeholder="WikiOS page (e.g. Vanguard Aerospace)"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={fetchingWiki || (!form.wikiInput.trim() && !form.name.trim())}
                onClick={() => void handleImportWiki()}
              >
                <BookStack className="mr-1.5 size-3.5" aria-hidden />
                {fetchingWiki ? "Importing..." : "Sync from WikiOS"}
              </Button>
              {wikiPreview && (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => {
                    setWikiPreview(null);
                    setForm((prev) => ({ ...prev, wikiInput: "" }));
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </Card>

          {wikiPreview && (
            <WikiLoreBanner wikiData={wikiPreview.wikiData} wikiSlug={wikiPreview.wikiSlug} />
          )}

          <div className="space-y-3">
            <Field id="exchange-company-name" label="Company name">
              <Input
                id="exchange-company-name"
                value={form.name}
                maxLength={60}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Northgate Holdings"
              />
            </Field>
            <Field id="exchange-company-sector" label="Sector">
              <SectorSelect
                id="exchange-company-sector"
                value={form.sector}
                onChange={(sector) =>
                  setForm({
                    ...form,
                    sector,
                    subIndustryKey: (subIndustriesOf(sector)[0]?.key ??
                      form.subIndustryKey) as SubIndustryKey,
                  })
                }
              />
            </Field>
            <Field id="exchange-company-subindustry" label="Sub-industry">
              <SubIndustrySelect
                id="exchange-company-subindustry"
                sectorKey={form.sector}
                value={form.subIndustryKey}
                onChange={(subIndustryKey) => setForm({ ...form, subIndustryKey })}
              />
            </Field>
            <Field id="exchange-company-hq" label="Domicile nation (optional)">
              <Select
                value={form.hqCountryId}
                onValueChange={(hqCountryId) => setForm({ ...form, hqCountryId })}
              >
                <SelectTrigger id="exchange-company-hq" size="sm" aria-label="Domicile nation">
                  <SelectValue placeholder="Unincorporated" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unincorporated (no domicile)</SelectItem>
                  {overview.realmNations.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.name} ({n.economicTier})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={found.isPending || atCap || form.name.trim().length < 3}
          >
            {found.isPending
              ? "Chartering..."
              : `Charter for ${formatSovereigns(overview.companyRules.charterFee)}`}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

