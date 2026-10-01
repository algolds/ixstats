"use client";
// src/app/admin/wiki/components/SystemTuningSection.tsx
// System tuning, cache management, template synchronization, and cron schedule configuration.

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import {
  Database,
  ControlSlider as SlidersHorizontal,
  ControlSlider as Sliders,
  Trash as Trash2,
  SystemRestart as Loader2,
  WarningTriangle as AlertTriangle,
  FloppyDisk as Save,
} from "iconoir-react";
import { LorewardWeightsCard } from "./LorewardWeightsCard";
import { FacetCard } from "~/components/ui/facet-container";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "~/components/ui/table";

export function SystemTuningSection() {
  const notify = useNotify();

  // Cache Operations
  const [purgePage, setPurgePage] = useState("");
  const purgeCacheMutation = api.admin.purgeWikiCache.useMutation({
    onSuccess: (data) => {
      notify.success(
        "Cache Purged",
        `Cleared ${data.clearedCount} cache entries for "${purgePage}"`
      );
      setPurgePage("");
    },
    onError: (err) => notify.error("Error", err.message),
  });

  const purgeAllCacheMutation = api.admin.purgeAllWikiCache.useMutation({
    onSuccess: (data) => {
      notify.success("Cache Purged", `Cleared all ${data.clearedCount} wiki cache entries`);
    },
    onError: (err) => notify.error("Error", err.message),
  });

  const handlePurgePage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!purgePage.trim()) return;
    purgeCacheMutation.mutate({ pageTitle: purgePage });
  };

  const handlePurgeAll = () => {
    if (
      confirm(
        "Are you sure you want to flush ALL cached wiki articles? This will force Parsoid fetches on reload."
      )
    ) {
      purgeAllCacheMutation.mutate();
    }
  };

  // Synced Templates list & Sync Actions
  const [templateSearchInput, setTemplateSearchInput] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [templateCategoryInput, setTemplateCategoryInput] = useState("");

  const {
    data: templates,
    isLoading: isLoadingTemplates,
    refetch: refetchTemplates,
  } = api.admin.getWikiTemplatesList.useQuery();

  const { data: suggestions } = api.admin.searchMediaWikiTemplates.useQuery(
    { query: templateSearchInput },
    { enabled: templateSearchInput.trim().length >= 2 }
  );

  const syncTemplateMutation = api.admin.syncWikiTemplateByName.useMutation({
    onSuccess: (data: any) => {
      notify.success("Template Synced", `Successfully synced template: ${data.name}`);
      refetchTemplates();
      setTemplateSearchInput("");
      setShowSuggestions(false);
    },
    onError: (err) => notify.error("Sync Error", err.message),
  });

  const syncCategoryMutation = api.admin.syncWikiTemplatesByCategory.useMutation({
    onSuccess: (data) => {
      notify.success(
        "Category Synced",
        `Successfully synced ${data.synced} of ${data.total} templates.`
      );
      refetchTemplates();
      setTemplateCategoryInput("");
    },
    onError: (err) => notify.error("Sync Error", err.message),
  });

  const handleSyncTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateSearchInput.trim()) return;
    syncTemplateMutation.mutate({ name: templateSearchInput.trim() });
  };

  const handleSyncCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateCategoryInput.trim()) return;
    syncCategoryMutation.mutate({ category: templateCategoryInput.trim() });
  };

  // Cron schedule editor
  const { data: cronSchedules, refetch: refetchCron } = api.admin.getCronSchedules.useQuery();
  const [cronScoring, setCronScoring] = useState("");
  const [cronIncome, setCronIncome] = useState("");
  const [cronCard, setCronCard] = useState("");

  useEffect(() => {
    if (cronSchedules) {
      setCronScoring(cronSchedules.cronSchedule_lorewardsScoring);
      setCronIncome(cronSchedules.cronSchedule_passiveIncome);
      setCronCard(cronSchedules.cronSchedule_cardValue);
    }
  }, [cronSchedules]);

  const saveCronMutation = api.admin.saveCronSchedules.useMutation({
    onSuccess: () => {
      notify.success("Cron Saved", "Cron schedules updated. Restart PM2 server to apply.");
      refetchCron();
    },
    onError: (err) => notify.error("Error Saving Cron", err.message),
  });

  const handleSaveCron = (e: React.FormEvent) => {
    e.preventDefault();
    saveCronMutation.mutate({
      cronSchedule_lorewardsScoring: cronScoring,
      cronSchedule_passiveIncome: cronIncome,
      cronSchedule_cardValue: cronCard,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left Column: Scoring Parameters & Tuning */}
      <LorewardWeightsCard />

      {/* Right Column: Cache, Templates, Cron */}
      <div className="space-y-6">
        {/* Cache Utilities */}
        <FacetCard className="space-y-4 p-5">
          <div className="border-separator flex items-center gap-2 border-b pb-3">
            <Database className="text-green h-4 w-4" />
            <div>
              <h3 className="text-label text-caption">Cache Operations</h3>
              <p className="text-label-secondary text-footnote">
                Purge article wikitext and page parse trees from memory
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <form onSubmit={handlePurgePage} className="flex gap-2">
              <Input
                placeholder="Enter article title to purge..."
                value={purgePage}
                onChange={(e) => setPurgePage(e.target.value)}
                className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                required
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={purgeCacheMutation.isPending}
                className="shrink-0"
              >
                {purgeCacheMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Purge Page"
                )}
              </Button>
            </form>

            <div className="border-separator border-t pt-2">
              <Button
                onClick={handlePurgeAll}
                disabled={purgeAllCacheMutation.isPending}
                variant="destructive"
                size="sm"
                className="w-full gap-2"
              >
                {purgeAllCacheMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Purge All Article Caches
              </Button>
            </div>
          </div>
        </FacetCard>

        {/* Wiki Templates Synchronization */}
        <FacetCard className="space-y-4 p-5">
          <div className="border-separator flex items-center gap-2 border-b pb-3">
            <SlidersHorizontal className="text-indigo h-4 w-4" />
            <div>
              <h3 className="text-label text-caption">Wiki Templates Synchronization</h3>
              <p className="text-label-secondary text-footnote">
                Registered template components synced from MediaWiki
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="border-separator grid gap-3 border-b pb-3 md:grid-cols-2">
              <form onSubmit={handleSyncTemplate} className="space-y-2">
                <label className="text-label text-caption block">Sync by Name</label>
                <div className="relative flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      placeholder="e.g. Infobox Country"
                      value={templateSearchInput}
                      onChange={(e) => {
                        setTemplateSearchInput(e.target.value);
                        setShowSuggestions(true);
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                    />
                    {showSuggestions && suggestions && suggestions.length > 0 && (
                      <FacetListSection
                        variant="plain"
                        aria-label="Template suggestions"
                        className="border-separator bg-surface-elevated text-label rounded-row shadow-floating absolute z-50 mt-1 max-h-40 w-full overflow-y-auto border"
                      >
                        {suggestions.map((name) => (
                          <FacetRow
                            key={name}
                            onClick={() => {
                              setTemplateSearchInput(name);
                              setShowSuggestions(false);
                            }}
                            title={name}
                          />
                        ))}
                      </FacetListSection>
                    )}
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={syncTemplateMutation.isPending}
                    className="shrink-0"
                  >
                    {syncTemplateMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Sync"
                    )}
                  </Button>
                </div>
              </form>

              <form onSubmit={handleSyncCategory} className="space-y-2">
                <label className="text-label text-caption block">Sync by Category</label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Country templates"
                    value={templateCategoryInput}
                    onChange={(e) => setTemplateCategoryInput(e.target.value)}
                    className="rounded-control-sm md:text-footnote h-(--control-height-sm)"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={syncCategoryMutation.isPending}
                    className="shrink-0"
                  >
                    {syncCategoryMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Sync"
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {isLoadingTemplates ? (
              <div className="space-y-2">
                <Skeleton className="rounded-control h-8 w-full" />
                <Skeleton className="rounded-control h-8 w-full" />
              </div>
            ) : !templates || templates.length === 0 ? (
              <div className="text-label-secondary text-footnote py-4 text-center italic">
                No templates synchronized yet.
              </div>
            ) : (
              <Table containerClassName="max-h-[12rem]">
                <TableHeader sticky>
                  <TableRow>
                    <TableHead className="px-3">Template Name</TableHead>
                    <TableHead className="px-3">Category</TableHead>
                    <TableHead className="px-3 text-right">Usage</TableHead>
                    <TableHead className="px-3 text-right">Params</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((tpl) => (
                    <TableRow key={tpl.id}>
                      <TableCell className="text-label px-3 font-mono font-medium">
                        {tpl.name}
                      </TableCell>
                      <TableCell className="text-label-secondary px-3">
                        {tpl.category || "—"}
                      </TableCell>
                      <TableCell className="text-label-secondary px-3 text-right">
                        {tpl.usageCount}
                      </TableCell>
                      <TableCell className="text-label-secondary px-3 text-right">
                        {tpl.paramCount}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </FacetCard>

        {/* Cron Schedules Editor */}
        <FacetCard className="space-y-4 p-5">
          <div className="border-separator flex items-center gap-2 border-b pb-3">
            <Sliders className="text-green h-4 w-4" />
            <div>
              <h3 className="text-label text-caption">Cron Schedules Editor</h3>
              <p className="text-label-secondary text-footnote">
                Configure background job intervals in standard 5-field cron syntax
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <form onSubmit={handleSaveCron} className="space-y-3">
              <div className="space-y-2">
                <label className="text-label text-caption">Lorewards Scoring Schedule</label>
                <Input
                  placeholder="e.g. 0 6 * * *"
                  value={cronScoring}
                  onChange={(e) => setCronScoring(e.target.value)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-label text-caption">Passive Income Schedule</label>
                <Input
                  placeholder="e.g. 0 0 * * *"
                  value={cronIncome}
                  onChange={(e) => setCronIncome(e.target.value)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-label text-caption">Card Value Tracking Schedule</label>
                <Input
                  placeholder="e.g. 0 */6 * * *"
                  value={cronCard}
                  onChange={(e) => setCronCard(e.target.value)}
                  className="rounded-control-sm md:text-footnote h-(--control-height-sm) font-mono"
                  required
                />
              </div>

              <div className="rounded-row border-yellow/30 bg-yellow/10 text-footnote text-yellow flex gap-2 border p-3">
                <AlertTriangle className="text-yellow h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">PM2 Restart Required</p>
                  <p className="text-footnote mt-0.5 opacity-80">
                    Changing schedules updates SystemConfig values. Next time the custom server is
                    restarted via PM2, these new schedule intervals will take effect.
                  </p>
                </div>
              </div>

              <Button type="submit" disabled={saveCronMutation.isPending} className="w-full gap-2">
                {saveCronMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Save className="h-3.5 w-3.5" />
                Save Cron Configuration
              </Button>
            </form>
          </div>
        </FacetCard>
      </div>
    </div>
  );
}
