// src/app/admin/wiki/components/SystemTuningSection.tsx
// System tuning, cache management, template synchronization, and cron schedule configuration.

"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Database, ControlSlider as SlidersHorizontal, ControlSlider as Sliders, Trash as Trash2, SystemRestart as Loader2, WarningTriangle as AlertTriangle, FloppyDisk as Save } from "iconoir-react";
import { LorewardWeightsCard } from "./LorewardWeightsCard";

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
        <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border/20 pb-3">
            <Database className="h-4 w-4 text-emerald-400" />
            <div>
              <h3 className="text-xs font-bold text-foreground">Cache Operations</h3>
              <p className="text-muted-foreground text-[11px]">
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
                className="h-8 rounded-xl border-border/30 bg-background/50 text-xs"
                required
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={purgeCacheMutation.isPending}
                className="h-8 rounded-xl px-3.5 text-xs font-semibold active:scale-[0.98] transition-transform shrink-0"
              >
                {purgeCacheMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Purge Page"
                )}
              </Button>
            </form>

            <div className="border-border/20 border-t pt-2">
              <Button
                onClick={handlePurgeAll}
                disabled={purgeAllCacheMutation.isPending}
                variant="destructive"
                size="sm"
                className="h-8 w-full gap-2 rounded-xl text-xs font-semibold active:scale-[0.98] transition-transform"
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
        </div>

        {/* Wiki Templates Synchronization */}
        <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border/20 pb-3">
            <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
            <div>
              <h3 className="text-xs font-bold text-foreground">Wiki Templates Synchronization</h3>
              <p className="text-muted-foreground text-[11px]">Registered template components synced from MediaWiki</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="border-border/20 grid gap-3 border-b pb-3 md:grid-cols-2">
              <form onSubmit={handleSyncTemplate} className="space-y-1.5">
                <label className="text-foreground block text-xs font-medium">Sync by Name</label>
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
                      className="h-8 rounded-xl border-border/30 bg-background/50 text-xs"
                    />
                    {showSuggestions && suggestions && suggestions.length > 0 && (
                      <div className="border-border/40 bg-popover/95 text-popover-foreground absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-xl border p-1 shadow-lg backdrop-blur-md">
                        {suggestions.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setTemplateSearchInput(name);
                              setShowSuggestions(false);
                            }}
                            className="hover:bg-muted/50 w-full rounded-lg px-2.5 py-1 text-left text-xs font-medium transition-colors"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={syncTemplateMutation.isPending}
                    className="h-8 rounded-xl px-3 text-xs font-semibold active:scale-[0.98] transition-transform shrink-0"
                  >
                    {syncTemplateMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Sync"
                    )}
                  </Button>
                </div>
              </form>

              <form onSubmit={handleSyncCategory} className="space-y-1.5">
                <label className="text-foreground block text-xs font-medium">
                  Sync by Category
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Country templates"
                    value={templateCategoryInput}
                    onChange={(e) => setTemplateCategoryInput(e.target.value)}
                    className="h-8 rounded-xl border-border/30 bg-background/50 text-xs"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={syncCategoryMutation.isPending}
                    className="h-8 rounded-xl px-3 text-xs font-semibold active:scale-[0.98] transition-transform shrink-0"
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
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            ) : !templates || templates.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-xs italic">
                No templates synchronized yet.
              </div>
            ) : (
              <div className="border-border/30 max-h-[12rem] overflow-y-auto rounded-xl border text-xs">
                <table className="w-full">
                  <thead className="bg-muted/30 sticky top-0 font-medium">
                    <tr className="border-border/30 border-b">
                      <th className="text-muted-foreground px-3 py-2 text-left">Template Name</th>
                      <th className="text-muted-foreground px-3 py-2 text-left">Category</th>
                      <th className="text-muted-foreground px-3 py-2 text-right">Usage</th>
                      <th className="text-muted-foreground px-3 py-2 text-right">Params</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/15 divide-y">
                    {templates.map((tpl) => (
                      <tr key={tpl.id} className="hover:bg-foreground/[0.02]">
                        <td className="text-foreground px-3 py-2 font-mono font-medium">
                          {tpl.name}
                        </td>
                        <td className="text-muted-foreground px-3 py-2">{tpl.category || "—"}</td>
                        <td className="text-muted-foreground px-3 py-2 text-right font-mono">
                          {tpl.usageCount}
                        </td>
                        <td className="text-muted-foreground px-3 py-2 text-right font-mono">
                          {tpl.paramCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Cron Schedules Editor */}
        <div className="rounded-2xl border border-border/30 bg-card/25 p-5 backdrop-blur-md shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-border/20 pb-3">
            <Sliders className="h-4 w-4 text-emerald-400" />
            <div>
              <h3 className="text-xs font-bold text-foreground">Cron Schedules Editor</h3>
              <p className="text-muted-foreground text-[11px]">
                Configure background job intervals in standard 5-field cron syntax
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <form onSubmit={handleSaveCron} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-foreground text-xs font-medium">
                  Lorewards Scoring Schedule
                </label>
                <Input
                  placeholder="e.g. 0 6 * * *"
                  value={cronScoring}
                  onChange={(e) => setCronScoring(e.target.value)}
                  className="h-8 rounded-xl border-border/30 bg-background/50 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-xs font-medium">
                  Passive Income Schedule
                </label>
                <Input
                  placeholder="e.g. 0 0 * * *"
                  value={cronIncome}
                  onChange={(e) => setCronIncome(e.target.value)}
                  className="h-8 rounded-xl border-border/30 bg-background/50 text-xs font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-xs font-medium">
                  Card Value Tracking Schedule
                </label>
                <Input
                  placeholder="e.g. 0 */6 * * *"
                  value={cronCard}
                  onChange={(e) => setCronCard(e.target.value)}
                  className="h-8 rounded-xl border-border/30 bg-background/50 text-xs font-mono"
                  required
                />
              </div>

              <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                <div>
                  <p className="font-semibold">PM2 Restart Required</p>
                  <p className="mt-0.5 opacity-80 text-[11px]">
                    Changing schedules updates SystemConfig values. Next time the custom server is
                    restarted via PM2, these new schedule intervals will take effect.
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={saveCronMutation.isPending}
                className="h-8 w-full gap-2 rounded-xl text-xs font-semibold active:scale-[0.98] transition-transform"
              >
                {saveCronMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <Save className="h-3.5 w-3.5" />
                Save Cron Configuration
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
