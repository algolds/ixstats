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
import { Button } from "~/components/ui/button";

export function WikiOSOptionsPanel() {
  const notify = useNotify();
  const utils = api.useUtils();

  // Media theme
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
        title="WikiOS options"
        category="Platform & preferences"
        description="Reader navigation, citation previews, media styles and background lore scanning."
        actions={
          <Button asChild variant="secondary" size="sm">
            <Link href="/wiki" data-cuelume-press="soft">
              <WikiOSLogomark className="h-3.5 w-auto" />
              <span>Open WikiOS</span>
              <ExternalLink aria-hidden />
            </Link>
          </Button>
        }
      />

      {/* Reader layout and navigation */}
      <SettingsGroup
        title="Reader layout and navigation"
        description="Reading tools, floating outlines and citation tooltips."
      >
        <SettingsSwitchRow
          id="citation-tooltips"
          label="Citation tooltips"
          description="Show a preview card when you hover a citation number or reference tag"
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
          label="Article outline"
          description="Show a floating table of contents on long articles"
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
          label="Wiki results in search"
          description="Suggest wiki articles in global search and Halo"
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
          label="Open links in a new tab"
          description="Open external wiki references and links between articles in new browser tabs"
          icon={ExternalLink}
          glyphClass="bg-emerald-500/15 text-emerald-500"
          checked={openInNewTab}
          onCheckedChange={(checked) => {
            soundEffects.toggle();
            setOpenInNewTab(checked);
          }}
        />
      </SettingsGroup>

      {/* Media appearance */}
      <SettingsGroup
        title="Media appearance"
        description="How flags, seals and transparent diagrams are shown."
      >
        <SettingsRow
          label="Image backplate"
          description={
            mediaThemeMode === "plinth"
              ? "Light backplate: transparent PNG flags sit on a light plate in dark mode"
              : "Adaptive: transparent images blend with the dark background"
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
              {mediaThemeMode === "plinth" ? "Light backplate" : "Adaptive"}
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

      {/* Simulation and lore */}
      <SettingsGroup
        title="Simulation and lore"
        description="How WikiOS articles connect to MyCountry."
      >
        <SettingsSwitchRow
          id="wiki-autoscan"
          label="MyCountry inline lore"
          description="Show wiki section summaries and national history excerpts between cards in MyCountry"
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
