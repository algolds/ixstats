// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
// src/components/profile/WikiPreferencesCard.tsx
// Wiki & lore preferences card for user profile page
"use client";

import { useState, useEffect } from "react";
import { BookOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";

type WikiSource = "ixwiki_first" | "iiwiki_first" | "both";
type LoreDisplayMode = "inline" | "sidebar" | "hidden";

interface WikiPreferences {
  wikiAutoScan: boolean;
  wikiSourcePriority: WikiSource;
  loreDisplayMode: LoreDisplayMode;
}

const SOURCE_OPTIONS: { value: WikiSource; label: string; description: string }[] = [
  { value: "ixwiki_first", label: "IxWiki first", description: "Prefer IxWiki articles" },
  { value: "iiwiki_first", label: "IIWiki first", description: "Prefer IIWiki articles" },
  { value: "both", label: "Both", description: "Show results from both wikis" },
];

const DISPLAY_OPTIONS: { value: LoreDisplayMode; label: string; description: string }[] = [
  {
    value: "inline",
    label: "Inline with stats",
    description: "Lore sections appear alongside data",
  },
  { value: "sidebar", label: "Sidebar only", description: "Lore content in sidebar panels" },
  { value: "hidden", label: "Hidden", description: "Disable lore display entirely" },
];

export function WikiPreferencesCard() {
  const utils = api.useUtils();

  const { data: preferences, isLoading } = api.users.getPreferences.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const updateMutation = api.users.updateWikiPreferences.useMutation({
    onSuccess: () => {
      void utils.users.getPreferences.invalidate();
    },
  });

  const [localPrefs, setLocalPrefs] = useState<WikiPreferences>({
    wikiAutoScan: true,
    wikiSourcePriority: "ixwiki_first",
    loreDisplayMode: "inline",
  });

  // Sync from server when loaded
  useEffect(() => {
    if (preferences) {
      setLocalPrefs({
        wikiAutoScan: preferences.wikiAutoScan ?? true,
        wikiSourcePriority: (preferences.wikiSourcePriority as WikiSource) ?? "ixwiki_first",
        loreDisplayMode: (preferences.loreDisplayMode as LoreDisplayMode) ?? "inline",
      });
    }
  }, [preferences]);

  function handleUpdate(patch: Partial<WikiPreferences>) {
    const updated = { ...localPrefs, ...patch };
    setLocalPrefs(updated);
    updateMutation.mutate(updated);
  }

  if (isLoading) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BookOpen className="h-5 w-5 text-indigo-500" />
            Wiki &amp; Lore Preferences
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-6 w-48 rounded" />
            <div className="bg-muted h-6 w-64 rounded" />
            <div className="bg-muted h-6 w-56 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="dark:bg-card/60 relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-white/40 p-6">
        <TextureOverlay texture="paperGrain" opacity={0.03} />
        <div className="relative z-10 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h2 className="dark:text-foreground text-xl font-bold text-slate-900">LoreScanner</h2>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="dark:bg-secondary/50 flex items-center justify-between rounded-2xl bg-slate-50/50 p-4">
            <div>
              <Label
                htmlFor="wiki-auto-scan"
                className="dark:text-foreground text-sm font-bold text-slate-900"
              >
                Autonomous Intelligence
              </Label>
              <p className="dark:text-muted-foreground text-xs font-medium text-slate-500">
                Auto-scan for relevant lore
              </p>
            </div>
            <Switch
              id="wiki-auto-scan"
              checked={localPrefs.wikiAutoScan}
              onCheckedChange={(checked) => handleUpdate({ wikiAutoScan: checked })}
              disabled={updateMutation.isPending}
              className="data-[state=checked]:bg-indigo-600"
            />
          </div>

          <div className="space-y-3">
            <label className="dark:text-muted-foreground block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Primary Knowledge Base
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SOURCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleUpdate({ wikiSourcePriority: option.value })}
                  disabled={updateMutation.isPending}
                  className={cn(
                    "glass-interactive flex flex-col gap-1 rounded-2xl border p-4 text-left transition-all duration-150",
                    localPrefs.wikiSourcePriority === option.value
                      ? "dark:text-foreground border-indigo-500/50 bg-indigo-500/10 text-slate-900 shadow-inner shadow-indigo-500/5"
                      : "dark:border-border dark:bg-secondary/40 dark:text-muted-foreground dark:hover:bg-secondary border-slate-200 bg-white/30 text-slate-600 hover:bg-white"
                  )}
                >
                  <span className="text-xs font-bold tracking-widest uppercase">
                    {option.label}
                  </span>
                  <span className="text-[10px] font-medium opacity-70">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="dark:text-muted-foreground block text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Interface Integration
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {DISPLAY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleUpdate({ loreDisplayMode: option.value })}
                  disabled={updateMutation.isPending}
                  className={cn(
                    "glass-interactive flex flex-col gap-1 rounded-2xl border p-4 text-left transition-all duration-150",
                    localPrefs.loreDisplayMode === option.value
                      ? "dark:text-foreground border-indigo-500/50 bg-indigo-500/10 text-slate-900 shadow-inner shadow-indigo-500/5"
                      : "dark:border-border dark:bg-secondary/40 dark:text-muted-foreground dark:hover:bg-secondary border-slate-200 bg-white/30 text-slate-600 hover:bg-white"
                  )}
                >
                  <span className="text-xs font-bold tracking-widest uppercase">
                    {option.label}
                  </span>
                  <span className="text-[10px] font-medium opacity-70">{option.description}</span>
                </button>
              ))}
            </div>
          </div>

          {(updateMutation.isPending || updateMutation.isError) && (
            <div className="mt-4 flex items-center justify-center">
              {updateMutation.isPending && (
                <p className="animate-pulse text-[10px] font-bold tracking-widest text-indigo-500 uppercase">
                  Synchronizing State...
                </p>
              )}
              {updateMutation.isError && (
                <p className="text-[10px] font-bold tracking-widest text-red-500 uppercase">
                  Transmission Failed
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
