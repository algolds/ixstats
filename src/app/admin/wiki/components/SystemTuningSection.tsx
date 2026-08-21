// src/app/admin/wiki/components/SystemTuningSection.tsx
// System tuning, cache management, template synchronization, and cron schedule configuration.

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Database, SlidersHorizontal, Sliders, Trash2, Loader2, AlertTriangle, Save } from "lucide-react";
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
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5 text-emerald-500" />
              Cache Operations
            </CardTitle>
            <CardDescription>
              Purge article wikitext and page parse trees from memory
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handlePurgePage} className="flex gap-2">
              <Input
                placeholder="Enter article title to purge..."
                value={purgePage}
                onChange={(e) => setPurgePage(e.target.value)}
                required
              />
              <Button
                type="submit"
                variant="outline"
                disabled={purgeCacheMutation.isPending}
                className="shrink-0"
              >
                {purgeCacheMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
                className="w-full gap-2"
              >
                {purgeAllCacheMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Purge All Article Caches
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Wiki Templates Synchronization */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
              Wiki Templates Synchronization
            </CardTitle>
            <CardDescription>Registered template components synced from MediaWiki</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-border/20 grid gap-4 border-b pb-2 md:grid-cols-2">
              <form onSubmit={handleSyncTemplate} className="space-y-2">
                <label className="text-foreground block text-xs font-semibold">Sync by Name</label>
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
                    />
                    {showSuggestions && suggestions && suggestions.length > 0 && (
                      <div className="border-border bg-card/95 absolute z-50 mt-1 max-h-40 w-full overflow-y-auto rounded-md border p-1 shadow-lg backdrop-blur-md">
                        {suggestions.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setTemplateSearchInput(name);
                              setShowSuggestions(false);
                            }}
                            className="hover:bg-accent hover:text-accent-foreground w-full rounded px-3 py-1.5 text-left text-xs transition-colors"
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
                    disabled={syncTemplateMutation.isPending}
                    className="shrink-0"
                  >
                    {syncTemplateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Sync"
                    )}
                  </Button>
                </div>
              </form>

              <form onSubmit={handleSyncCategory} className="space-y-2">
                <label className="text-foreground block text-xs font-semibold">
                  Sync by Category
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. Country templates"
                    value={templateCategoryInput}
                    onChange={(e) => setTemplateCategoryInput(e.target.value)}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={syncCategoryMutation.isPending}
                    className="shrink-0"
                  >
                    {syncCategoryMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Sync"
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {isLoadingTemplates ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !templates || templates.length === 0 ? (
              <div className="text-muted-foreground py-4 text-center text-xs italic">
                No templates synchronized yet.
              </div>
            ) : (
              <div className="border-border/30 max-h-[12rem] overflow-y-auto rounded-lg border text-xs">
                <table className="w-full">
                  <thead className="bg-muted sticky top-0 font-medium">
                    <tr className="border-border/30 border-b">
                      <th className="text-muted-foreground px-3 py-2 text-left">Template Name</th>
                      <th className="text-muted-foreground px-3 py-2 text-left">Category</th>
                      <th className="text-muted-foreground px-3 py-2 text-right">Usage</th>
                      <th className="text-muted-foreground px-3 py-2 text-right">Params</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border/20 divide-y">
                    {templates.map((tpl) => (
                      <tr key={tpl.id} className="hover:bg-muted/30">
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
          </CardContent>
        </Card>

        {/* Cron Schedules Editor */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sliders className="h-5 w-5 text-emerald-500" />
              Cron Schedules Editor
            </CardTitle>
            <CardDescription>
              Configure background job intervals in standard 5-field cron syntax
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSaveCron} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Lorewards Scoring Schedule
                </label>
                <Input
                  placeholder="e.g. 0 6 * * *"
                  value={cronScoring}
                  onChange={(e) => setCronScoring(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Passive Income Schedule
                </label>
                <Input
                  placeholder="e.g. 0 0 * * *"
                  value={cronIncome}
                  onChange={(e) => setCronIncome(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-foreground text-sm font-medium">
                  Card Value Tracking Schedule
                </label>
                <Input
                  placeholder="e.g. 0 */6 * * *"
                  value={cronCard}
                  onChange={(e) => setCronCard(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">PM2 Restart Required</p>
                  <p className="mt-0.5 opacity-80">
                    Changing schedules updates SystemConfig values. Next time the custom server is
                    restarted via PM2, these new schedule intervals will be scheduled.
                  </p>
                </div>
              </div>

              <Button
                type="submit"
                disabled={saveCronMutation.isPending}
                className="w-full gap-2 border-0 bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700"
              >
                {saveCronMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                <Save className="h-4 w-4" />
                Save Cron Configuration
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
