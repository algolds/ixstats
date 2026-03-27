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
  { value: "inline", label: "Inline with stats", description: "Lore sections appear alongside data" },
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
            <div className="h-6 w-48 rounded bg-muted" />
            <div className="h-6 w-64 rounded bg-muted" />
            <div className="h-6 w-56 rounded bg-muted" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-indigo-500" />
          Wiki &amp; Lore Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Wiki Auto-Scan Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="wiki-auto-scan" className="text-sm font-medium text-foreground">
              Wiki Auto-Scan
            </Label>
            <p className="text-xs text-muted-foreground">
              Automatically show wiki lore sections in all tabs
            </p>
          </div>
          <Switch
            id="wiki-auto-scan"
            checked={localPrefs.wikiAutoScan}
            onCheckedChange={(checked) => handleUpdate({ wikiAutoScan: checked })}
            disabled={updateMutation.isPending}
          />
        </div>

        <div className="h-px bg-border/50" />

        {/* Wiki Source Priority */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium text-foreground">Wiki Source Priority</Label>
            <p className="text-xs text-muted-foreground">
              Choose which wiki source to check first for articles
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SOURCE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleUpdate({ wikiSourcePriority: option.value })}
                disabled={updateMutation.isPending}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-all duration-150",
                  localPrefs.wikiSourcePriority === option.value
                    ? "border-indigo-500/50 bg-indigo-500/10 text-foreground shadow-sm"
                    : "border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:bg-background/80"
                )}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs opacity-70">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-border/50" />

        {/* Lore Display Mode */}
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium text-foreground">Lore Display Mode</Label>
            <p className="text-xs text-muted-foreground">
              Control how wiki lore content appears throughout the app
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {DISPLAY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleUpdate({ loreDisplayMode: option.value })}
                disabled={updateMutation.isPending}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-all duration-150",
                  localPrefs.loreDisplayMode === option.value
                    ? "border-indigo-500/50 bg-indigo-500/10 text-foreground shadow-sm"
                    : "border-border/50 bg-background/50 text-muted-foreground hover:border-border hover:bg-background/80"
                )}
              >
                <span className="block text-sm font-medium">{option.label}</span>
                <span className="block text-xs opacity-70">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Saving indicator */}
        {updateMutation.isPending && (
          <p className="text-xs text-muted-foreground animate-pulse">Saving preferences...</p>
        )}
        {updateMutation.isError && (
          <p className="text-xs text-destructive">Failed to save. Please try again.</p>
        )}
      </CardContent>
    </Card>
  );
}
