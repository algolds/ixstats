"use client";

import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import React, { useState } from "react";
import Link from "next/link";
import {
  UserXmark,
  EyeClosed as EyeOff,
  Download,
  Lock,
  Key as KeyIcon,
  ShieldAlert,
  Trash,
  OpenNewWindow as ExternalLink,
  SystemRestart as Loader2,
  Check,
  Search,
  Plus,
  Xmark,
  ChatBubble as MessageCircle,
  Sparks as Sparkles,
  Globe,
  Coins,
  Group as Users,
  Activity,
  Filter,
} from "iconoir-react";
import { useClerk } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { SettingsHeader } from "../SettingsHeader";
import { SettingsGroup, SettingsRow, SettingsSwitchRow } from "../primitives";
import { soundEffects } from "~/lib/sound/cuelume";
import { NSTakedownModal } from "../modals/NSTakedownModal";
import { NationStatesLogo } from "~/components/cards/display/NationStatesLogo";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import type { PrivacyConfig } from "~/server/api/routers/users/preferences";

type FilterTab = "blocked" | "muted" | "keywords";

export function PrivacySecurityPanel() {
  const notify = useNotify();
  const utils = api.useUtils();
  const clerk = useClerk();

  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>("blocked");
  const [blockInput, setBlockInput] = useState("");
  const [muteInput, setMuteInput] = useState("");
  const [keywordInput, setKeywordInput] = useState("");

  const [showTakedownModal, setShowTakedownModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Queries
  const { data: privacyData } = api.users.getPrivacySettings.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const { refetch: fetchExportData } = api.users.exportUserData.useQuery(undefined, {
    enabled: false,
  });

  // Mutations with Optimistic Updates
  const updateConfigMutation = api.users.updatePrivacyConfig.useMutation({
    onMutate: async (newValues) => {
      soundEffects.toggle();
      await utils.users.getPrivacySettings.cancel();
      const prevData = utils.users.getPrivacySettings.getData();
      if (prevData) {
        utils.users.getPrivacySettings.setData(undefined, {
          ...prevData,
          config: { ...prevData.config, ...newValues },
        });
      }
      return { prevData };
    },
    onError: (err, _newValues, context) => {
      soundEffects.error();
      if (context?.prevData) {
        utils.users.getPrivacySettings.setData(undefined, context.prevData);
      }
      notify.error(err.message || "Failed to update privacy settings");
    },
    onSuccess: () => {
      notify.success("Privacy preferences updated");
    },
    onSettled: () => {
      void utils.users.getPrivacySettings.invalidate();
    },
  });

  const blockMutation = api.users.blockAccount.useMutation({
    onSuccess: () => {
      soundEffects.bloom();
      notify.success("Account added to blocklist");
      setBlockInput("");
      void utils.users.getPrivacySettings.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to block account");
    },
  });

  const unblockMutation = api.users.unblockAccount.useMutation({
    onSuccess: () => {
      soundEffects.press();
      notify.success("Account removed from blocklist");
      void utils.users.getPrivacySettings.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to unblock account");
    },
  });

  const muteMutation = api.users.muteAccount.useMutation({
    onSuccess: () => {
      soundEffects.bloom();
      notify.success("Account muted");
      setMuteInput("");
      void utils.users.getPrivacySettings.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to mute account");
    },
  });

  const unmuteMutation = api.users.unmuteAccount.useMutation({
    onSuccess: () => {
      soundEffects.press();
      notify.success("Account unmuted");
      void utils.users.getPrivacySettings.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to unmute account");
    },
  });

  const addKeywordMutation = api.users.addMutedKeyword.useMutation({
    onSuccess: () => {
      soundEffects.bloom();
      notify.success("Keyword filter added");
      setKeywordInput("");
      void utils.users.getPrivacySettings.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to add keyword filter");
    },
  });

  const removeKeywordMutation = api.users.removeMutedKeyword.useMutation({
    onSuccess: () => {
      soundEffects.press();
      notify.success("Keyword filter removed");
      void utils.users.getPrivacySettings.invalidate();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to remove keyword");
    },
  });

  const clearHistoryMutation = api.users.clearSearchHistory.useMutation({
    onSuccess: () => {
      soundEffects.bloom();
      notify.success("Search history and recent profiles cleared");
    },
    onError: () => {
      soundEffects.error();
      notify.error("Failed to clear search history");
    },
  });

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      soundEffects.press();
      const res = await fetchExportData();
      const dataToExport = res.data;

      if (!dataToExport) {
        throw new Error("The export returned no data");
      }

      const jsonBlob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(jsonBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `account-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      soundEffects.bloom();
      notify.success("Data archive downloaded");
    } catch (err: any) {
      soundEffects.error();
      notify.error(err.message || "Failed to generate data archive");
    } finally {
      setIsExporting(false);
    }
  };

  const config = privacyData?.config;
  const blockedAccounts = privacyData?.blockedAccounts ?? [];
  const mutedAccounts = privacyData?.mutedAccounts ?? [];
  const mutedKeywords = privacyData?.mutedKeywords ?? [];

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Privacy & Security"
        category="Platform & preferences"
        description="Blocking, who can contact you, discoverability, diagnostics and your data."
      />

      {/* Blocking and filtering */}
      <SettingsGroup
        title="Blocking and filtering"
        description="Stop accounts from messaging or tagging you, or appearing in your ThinkPages feeds."
      >
        <div className="space-y-4 p-4">
          <SegmentedControl
            aria-label="Filter list"
            size="sm"
            fullWidth
            value={activeFilterTab}
            onValueChange={(tab) => {
              soundEffects.press();
              setActiveFilterTab(tab);
            }}
            options={[
              { value: "blocked", label: `Blocked accounts (${blockedAccounts.length})` },
              { value: "muted", label: `Muted accounts (${mutedAccounts.length})` },
              { value: "keywords", label: `Muted words (${mutedKeywords.length})` },
            ]}
          />

          {/* Blocked accounts */}
          {activeFilterTab === "blocked" && (
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (blockInput.trim()) {
                    soundEffects.press();
                    blockMutation.mutate({ identifier: blockInput.trim() });
                  }
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
                  <Input
                    value={blockInput}
                    onChange={(e) => setBlockInput(e.target.value)}
                    placeholder="Username or country name to block"
                    className="bg-muted/20 border-border/60 h-8 pl-8 text-xs"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!blockInput.trim() || blockMutation.isPending}
                  data-cuelume-press="soft"
                  variant="secondary"
                  size="sm"
                >
                  {blockMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserXmark className="h-3.5 w-3.5 text-rose-500" />
                  )}
                  <span>Block</span>
                </Button>
              </form>

              {blockedAccounts.length === 0 ? (
                <div className="border-separator rounded-row border p-6 text-center">
                  <UserXmark className="text-muted-foreground/40 mx-auto mb-1.5 h-6 w-6" />
                  <p className="text-muted-foreground text-xs font-semibold">No blocked accounts</p>
                  <p className="text-muted-foreground/70 mx-auto mt-0.5 max-w-sm text-xs">
                    Blocked accounts cannot message you, invite you to ThinkTanks or tag you in
                    ThinkPages.
                  </p>
                </div>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {blockedAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="border-separator bg-surface-secondary rounded-row flex items-center justify-between gap-3 border p-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="bg-muted text-muted-foreground border-border/60 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-xs font-bold">
                          {account.avatarUrl ? (
                            <img
                              src={account.avatarUrl}
                              alt={account.label}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <UserXmark className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-foreground truncate text-xs font-bold">
                            {account.label}
                          </p>
                          <p className="text-muted-foreground text-xs">{account.subtitle}</p>
                        </div>
                      </div>

                      <Button
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          unblockMutation.mutate({ connectionId: account.id });
                        }}
                        disabled={unblockMutation.isPending}
                        data-cuelume-press="soft"
                        variant="secondary"
                        size="sm"
                      >
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Muted accounts */}
          {activeFilterTab === "muted" && (
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (muteInput.trim()) {
                    soundEffects.press();
                    muteMutation.mutate({ identifier: muteInput.trim() });
                  }
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
                  <Input
                    value={muteInput}
                    onChange={(e) => setMuteInput(e.target.value)}
                    placeholder="Username to mute"
                    className="bg-muted/20 border-border/60 h-8 pl-8 text-xs"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!muteInput.trim() || muteMutation.isPending}
                  data-cuelume-press="soft"
                  variant="secondary"
                  size="sm"
                >
                  {muteMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <EyeOff className="text-muted-foreground h-3.5 w-3.5" />
                  )}
                  <span>Mute</span>
                </Button>
              </form>

              {mutedAccounts.length === 0 ? (
                <div className="border-separator rounded-row border p-6 text-center">
                  <EyeOff className="text-muted-foreground/40 mx-auto mb-1.5 h-6 w-6" />
                  <p className="text-muted-foreground text-xs font-semibold">No muted accounts</p>
                  <p className="text-muted-foreground/70 mx-auto mt-0.5 max-w-sm text-xs">
                    Muted accounts are hidden from your feeds and notifications, and they are not
                    told.
                  </p>
                </div>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {mutedAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="border-separator bg-surface-secondary rounded-row flex items-center justify-between gap-3 border p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-xs font-bold">
                          {account.label}
                        </p>
                        <p className="text-muted-foreground text-xs">{account.subtitle}</p>
                      </div>

                      <Button
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          unmuteMutation.mutate({ connectionId: account.id });
                        }}
                        disabled={unmuteMutation.isPending}
                        data-cuelume-press="soft"
                        variant="secondary"
                        size="sm"
                      >
                        Unmute
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Muted words */}
          {activeFilterTab === "keywords" && (
            <div className="space-y-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (keywordInput.trim()) {
                    soundEffects.press();
                    addKeywordMutation.mutate({ keyword: keywordInput.trim() });
                  }
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Filter className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="Word, phrase or hashtag to filter"
                    className="bg-muted/20 border-border/60 h-8 pl-8 text-xs"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={!keywordInput.trim() || addKeywordMutation.isPending}
                  data-cuelume-press="soft"
                  variant="secondary"
                  size="sm"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add word</span>
                </Button>
              </form>

              {mutedKeywords.length === 0 ? (
                <div className="border-separator rounded-row border p-6 text-center">
                  <Filter className="text-muted-foreground/40 mx-auto mb-1.5 h-6 w-6" />
                  <p className="text-muted-foreground text-xs font-semibold">No muted words</p>
                  <p className="text-muted-foreground/70 mx-auto mt-0.5 max-w-sm text-xs">
                    Posts and notifications containing these words are hidden from your feed.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-1">
                  {mutedKeywords.map((item) => (
                    <span
                      key={item.id}
                      className="border-separator bg-surface-secondary text-foreground rounded-control-sm inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium"
                    >
                      <span>{item.keyword}</span>
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          removeKeywordMutation.mutate({ connectionId: item.id });
                        }}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Remove word"
                      >
                        <Xmark className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SettingsGroup>

      {/* Interactions */}
      <SettingsGroup
        title="Interactions"
        description="Who can message you, tag you and send you trades."
      >
        <SettingsRow
          label="Direct messages"
          description="Who can send you direct messages in ThinkShare"
          icon={MessageCircle}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Select
            value={config?.directMessages ?? "everyone"}
            onValueChange={(val) => {
              soundEffects.press();
              updateConfigMutation.mutate({
                directMessages: val as PrivacyConfig["directMessages"],
              });
            }}
          >
            <SelectTrigger
              size="sm"
              className="border-border/60 bg-muted/40 text-foreground w-[180px] rounded-xl text-xs font-semibold"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              <SelectItem value="followers">Followers only</SelectItem>
              <SelectItem value="verified">Verified accounts only</SelectItem>
              <SelectItem value="nobody">Nobody</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsSwitchRow
          id="dm-filtering"
          label="Message request filtering"
          description="Move messages from accounts you do not follow to a requests folder"
          icon={Filter}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.messageRequestFiltering ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ messageRequestFiltering: checked });
          }}
        />

        <SettingsRow
          label="Mentions and tags"
          description="Who can tag or mention you in ThinkPages posts and comments"
          icon={Sparkles}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Select
            value={config?.mentions ?? "everyone"}
            onValueChange={(val) => {
              soundEffects.press();
              updateConfigMutation.mutate({
                mentions: val as PrivacyConfig["mentions"],
              });
            }}
          >
            <SelectTrigger
              size="sm"
              className="border-border/60 bg-muted/40 text-foreground w-[180px] rounded-xl text-xs font-semibold"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              <SelectItem value="followers">People you follow</SelectItem>
              <SelectItem value="nobody">Nobody</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Trade and gift offers"
          description="Who can send you card trades or Vault gifts"
          icon={Coins}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Select
            value={config?.tradeOffers ?? "everyone"}
            onValueChange={(val) => {
              soundEffects.press();
              updateConfigMutation.mutate({
                tradeOffers: val as PrivacyConfig["tradeOffers"],
              });
            }}
          >
            <SelectTrigger
              size="sm"
              className="border-border/60 bg-muted/40 text-foreground w-[180px] rounded-xl text-xs font-semibold"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              <SelectItem value="followers">Followers only</SelectItem>
              <SelectItem value="nobody">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="ThinkTank invites"
          description="Who can invite you to private ThinkTanks"
          icon={Users}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Select
            value={config?.thinktankInvites ?? "everyone"}
            onValueChange={(val) => {
              soundEffects.press();
              updateConfigMutation.mutate({
                thinktankInvites: val as PrivacyConfig["thinktankInvites"],
              });
            }}
          >
            <SelectTrigger
              size="sm"
              className="border-border/60 bg-muted/40 text-foreground w-[180px] rounded-xl text-xs font-semibold"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              <SelectItem value="followers">Followers only</SelectItem>
              <SelectItem value="nobody">Nobody</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsGroup>

      {/* Discovery */}
      <SettingsGroup
        title="Discovery and visibility"
        description="Where you appear in search, whether you show as online and read receipts."
      >
        <SettingsSwitchRow
          id="search-discoverable"
          label="Appear in search and directories"
          description="Let your profile and country appear in global search and leaderboards"
          icon={Search}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.searchDiscoverable ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ searchDiscoverable: checked });
          }}
        />

        <SettingsSwitchRow
          id="search-engine-indexing"
          label="Search engine indexing"
          description="Let search engines such as Google and Bing index your public profile"
          icon={Globe}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.searchEngineIndexing ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ searchEngineIndexing: checked });
          }}
        />

        <SettingsSwitchRow
          id="online-status"
          label="Online status"
          description="Show when you are active on ThinkPages or browsing the map"
          icon={Activity}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.showOnlineStatus ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ showOnlineStatus: checked });
          }}
        />

        <SettingsSwitchRow
          id="read-receipts"
          label="Read receipts"
          description="Tell senders when you have read their ThinkShare messages"
          icon={Check}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.dmReadReceipts ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ dmReadReceipts: checked });
          }}
        />
      </SettingsGroup>

      {/* Connected services */}
      <SettingsGroup
        title="Connected services"
        description="Trading card indexing and linked accounts."
      >
        <SettingsRow
          label="NationStates card deck"
          description="Remove your card data from public search or unlink your deck"
          icon={NationStatesLogo}
          glyphClass="bg-muted/60 text-foreground"
        >
          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/settings?tab=cards" data-cuelume-press="soft">
                Manage deck
              </Link>
            </Button>
            <Button
              type="button"
              onClick={() => {
                soundEffects.press();
                setShowTakedownModal(true);
              }}
              data-cuelume-press="soft"
              variant="secondary"
              size="sm"
              className="hover:text-destructive"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Takedown and opt-out</span>
            </Button>
          </div>
        </SettingsRow>

        <SettingsSwitchRow
          id="show-discord-tag"
          label="Show Discord tag on profile"
          description="Show your connected Discord username on your public profile"
          icon={Users}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.showDiscordTag ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ showDiscordTag: checked });
          }}
        />

        <SettingsSwitchRow
          id="show-wiki-attribution"
          label="Wiki author attribution"
          description="Link your profile to wiki articles and lore you contributed"
          icon={Globe}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.showWikiAttribution ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ showWikiAttribution: checked });
          }}
        />
      </SettingsGroup>

      {/* Diagnostics and personalization */}
      <SettingsGroup
        title="Diagnostics and personalization"
        description="Diagnostics, recommendations and recent search history."
      >
        <SettingsSwitchRow
          id="diagnostic-telemetry"
          label="Anonymous diagnostics"
          description="Send anonymous error reports and load metrics to help improve IxStats"
          icon={Activity}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.diagnosticTelemetry ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ diagnosticTelemetry: checked });
          }}
        />

        <SettingsSwitchRow
          id="personalized-recommendations"
          label="Personalized recommendations"
          description="Use your collection, viewing history and topics to tailor recommendations"
          icon={Sparkles}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.personalizedRecommendations ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ personalizedRecommendations: checked });
          }}
        />

        <SettingsRow
          label="Search and browsing history"
          description="Clear cached search suggestions and recently visited countries"
          icon={Trash}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Button
            type="button"
            onClick={() => {
              soundEffects.press();
              clearHistoryMutation.mutate();
            }}
            disabled={clearHistoryMutation.isPending}
            data-cuelume-press="soft"
            variant="secondary"
            size="sm"
          >
            Clear history
          </Button>
        </SettingsRow>
      </SettingsGroup>

      {/* Security and data */}
      <SettingsGroup
        title="Security and data"
        description="Export your data and manage sessions and credentials."
      >
        <SettingsRow
          label="Export your data"
          description="Download a JSON export of your country data, card collection and account records"
          icon={Download}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Button
            type="button"
            onClick={handleExportData}
            disabled={isExporting}
            data-cuelume-press="soft"
            variant="secondary"
            size="sm"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>{isExporting ? "Generating..." : "Download archive"}</span>
          </Button>
        </SettingsRow>

        <SettingsRow
          label="Sessions and two-step verification"
          description="Manage signed-in devices, sessions and passkeys in your security profile"
          icon={Lock}
          glyphClass="bg-muted/60 text-foreground"
        >
          <Button
            type="button"
            onClick={() => {
              soundEffects.press();
              clerk.openUserProfile();
            }}
            data-cuelume-press="soft"
            variant="secondary"
            size="sm"
          >
            <KeyIcon className="text-muted-foreground h-3.5 w-3.5" />
            <span>Security profile</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </Button>
        </SettingsRow>
      </SettingsGroup>

      {/* NationStates card takedown */}
      <NSTakedownModal
        isOpen={showTakedownModal}
        onClose={() => setShowTakedownModal(false)}
        defaultNationName={userProfile?.country?.name ?? ""}
      />
    </div>
  );
}
