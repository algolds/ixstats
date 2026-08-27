"use client";

import Link from "next/link";
import {
  OpenNewWindow as ExternalLink,
  OpenBook as BookOpen,
  ChatBubble as MessageSquare,
  List,
  Search,
  Square,
  HalfMoon as SunMoon,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsRow, SettingsSwitchRow } from "../primitives";
import { soundEffects } from "~/lib/sound/cuelume";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { useWikiMediaTheme } from "~/components/wiki-os/shared/MediaThemeContext";
import { useLocalPref } from "~/components/halo/views/settings/SettingsControls";
import { Switch } from "~/components/ui/switch";

export function WikiOSOptionsPanel() {
  const notify = useNotify();
  const utils = api.useUtils();

  // Media theme hook (from Halo wiki settings)
  const { mediaThemeMode, setMediaThemeMode } = useWikiMediaTheme();

  // Reader local preferences (from Halo wiki settings)
  const [showCiteTooltips, setShowCiteTooltips] = useLocalPref("wikios:showCitationTooltips", true);
  const [showWikiToc, setShowWikiToc] = useLocalPref("wikios:showWikiToc", true);
  const [dynamicSearchWiki, setDynamicSearchWiki] = useLocalPref("wikios:dynamicSearchWiki", true);
  const [openInNewTab, setOpenInNewTab] = useLocalPref("wikios:openInNewTab", false);

  // Wiki server preferences query
  const { data: preferences } = api.users.getPreferences.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const updateWikiPrefsMutation = api.users.updateWikiPreferences.useMutation({
    onSuccess: () => {
      soundEffects.bloom();
      notify.success("Wiki preferences updated");
      void utils.users.getPreferences.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to update preferences");
    },
  });

  const wikiAutoScan = preferences?.wikiAutoScan ?? true;

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="WikiOS Options"
        category="Platform & Preferences"
        description="Reader navigation, citation previews, media styles, and background lore scanners."
        actions={
          <Link
            href="/wiki"
            data-cuelume-press="soft"
            className="facet-interactive border-border/60 bg-secondary/80 text-foreground hover:bg-secondary flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all active:scale-[0.98]"
          >
            <WikiOSLogomark className="h-3.5 w-auto" />
            <span>Open WikiOS</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </Link>
        }
      />

      {/* Reader Layout Preferences (from Halo Wiki View) */}
      <SettingsGroup
        title="Reader Layout & Navigation"
        description="Configure interactive reading tools, floating outlines, and citation tooltips."
      >
        <SettingsSwitchRow
          id="citation-tooltips"
          label="Citation Tooltips"
          description="Display interactive hover preview cards on citation numbers and reference tags"
          icon={MessageSquare}
          glyphClass="bg-purple-500/15 text-purple-500"
          checked={showCiteTooltips}
          onCheckedChange={(checked) => {
            soundEffects.toggle();
            setShowCiteTooltips(checked);
          }}
        />

        <SettingsSwitchRow
          id="article-toc"
          label="Article Outline Navigator"
          description="Show a floating table of contents navigator and chapter breakdown on long articles"
          icon={List}
          glyphClass="bg-cyan-500/15 text-cyan-500"
          checked={showWikiToc}
          onCheckedChange={(checked) => {
            soundEffects.toggle();
            setShowWikiToc(checked);
          }}
        />

        <SettingsSwitchRow
          id="quick-search"
          label="Dynamic Quick Search"
          description="Index and suggest wiki articles within global search and the Dynamic Island"
          icon={Search}
          glyphClass="bg-blue-500/15 text-blue-500"
          checked={dynamicSearchWiki}
          onCheckedChange={(checked) => {
            soundEffects.toggle();
            setDynamicSearchWiki(checked);
          }}
        />

        <SettingsSwitchRow
          id="open-new-tab"
          label="Open in New Tab"
          description="Open external wiki references and cross-article links in new browser tabs"
          icon={ExternalLink}
          glyphClass="bg-emerald-500/15 text-emerald-500"
          checked={openInNewTab}
          onCheckedChange={(checked) => {
            soundEffects.toggle();
            setOpenInNewTab(checked);
          }}
        />
      </SettingsGroup>

      {/* Media & Image Appearance (from Halo Wiki View) */}
      <SettingsGroup
        title="Media & Graphics Appearance"
        description="Visual presentation of flags, seal vectors, and transparent diagram overlays."
      >
        <SettingsRow
          label="Image Plinth Backplate"
          description={
            mediaThemeMode === "plinth"
              ? "Frosted Plate — renders dark-mode transparent PNG flags with an adaptive light backplate plinth"
              : "Adaptive Dark — standard transparency blending with dark mode backgrounds"
          }
          icon={mediaThemeMode === "plinth" ? Square : SunMoon}
          glyphClass={
            mediaThemeMode === "plinth"
              ? "bg-emerald-500/15 text-emerald-500"
              : "bg-sky-500/15 text-sky-500"
          }
        >
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs font-semibold">
              {mediaThemeMode === "plinth" ? "Light Plinth" : "Adaptive Dark"}
            </span>
            <Switch
              checked={mediaThemeMode === "plinth"}
              onCheckedChange={(checked) => {
                soundEffects.toggle();
                setMediaThemeMode(checked ? "plinth" : "auto");
              }}
            />
          </div>
        </SettingsRow>
      </SettingsGroup>

      {/* Simulation & Lore Synchronization */}
      <SettingsGroup
        title="Simulation & Lore Synchronization"
        description="Background integration between WikiOS articles and MyCountry tabs."
      >
        <SettingsSwitchRow
          id="wiki-autoscan"
          label="MyCountry Inline Lore"
          description="Display contextual wiki section summaries and national history excerpts between gameplay cards in MyCountry"
          icon={BookOpen}
          glyphClass="bg-indigo-500/15 text-indigo-500"
          checked={wikiAutoScan}
          onCheckedChange={(checked) => {
            soundEffects.press();
            updateWikiPrefsMutation.mutate({ wikiAutoScan: checked });
          }}
          disabled={updateWikiPrefsMutation.isPending}
        />
      </SettingsGroup>
    </div>
  );
}
