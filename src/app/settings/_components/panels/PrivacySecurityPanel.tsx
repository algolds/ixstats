"use client";

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
import { cn } from "~/lib/utils";
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
        throw new Error("No data returned from export service");
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
      notify.success("Account data archive downloaded successfully");
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
        category="Platform & Preferences"
        description="Manage account blocking, interaction safety, discovery visibility, telemetry, and data governance."
      />

      {/* 1. Blocked, Muted & Content Filtering */}
      <SettingsGroup
        title="Blocking & Content Filtering"
        description="Prevent unwanted accounts from messaging, tagging, or appearing in your Thinkpages feeds."
      >
        <div className="space-y-4 p-4">
          {/* Segmented Sub-Tab Switcher */}
          <div className="border-border/60 bg-muted/40 flex items-center gap-1 rounded-xl border p-1">
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setActiveFilterTab("blocked");
              }}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.98]",
                activeFilterTab === "blocked"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Blocked Accounts ({blockedAccounts.length})
            </button>
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setActiveFilterTab("muted");
              }}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.98]",
                activeFilterTab === "muted"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Muted Accounts ({mutedAccounts.length})
            </button>
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setActiveFilterTab("keywords");
              }}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all duration-150 active:scale-[0.98]",
                activeFilterTab === "keywords"
                  ? "bg-card text-foreground font-bold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Muted Words ({mutedKeywords.length})
            </button>
          </div>

          {/* Blocked Accounts Tab Content */}
          {activeFilterTab === "blocked" && (
            <div className="space-y-3">
              {/* Inline Block Input */}
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
                    placeholder="Enter username or country name to block..."
                    className="bg-muted/20 border-border/60 h-8 pl-8 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!blockInput.trim() || blockMutation.isPending}
                  data-cuelume-press="soft"
                  className="facet-interactive border-border/60 bg-secondary/80 text-foreground hover:bg-secondary flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold active:scale-[0.98] disabled:opacity-50"
                >
                  {blockMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserXmark className="h-3.5 w-3.5 text-rose-500" />
                  )}
                  <span>Block</span>
                </button>
              </form>

              {/* Blocked List */}
              {blockedAccounts.length === 0 ? (
                <div className="border-border/40 bg-card/20 rounded-xl border p-6 text-center">
                  <UserXmark className="text-muted-foreground/40 mx-auto mb-1.5 h-6 w-6" />
                  <p className="text-muted-foreground text-xs font-semibold">No blocked accounts</p>
                  <p className="text-muted-foreground/70 mx-auto mt-0.5 max-w-sm text-[11px]">
                    Blocked accounts cannot send you direct messages, invite you to thinktanks, or
                    tag you in Thinkpages.
                  </p>
                </div>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {blockedAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="border-border/40 bg-card/40 flex items-center justify-between gap-3 rounded-xl border p-2.5 shadow-2xs"
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
                          <p className="text-muted-foreground text-[10px]">{account.subtitle}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          unblockMutation.mutate({ connectionId: account.id });
                        }}
                        disabled={unblockMutation.isPending}
                        data-cuelume-press="soft"
                        className="facet-interactive border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground rounded-lg border px-2.5 py-1 text-xs font-semibold active:scale-[0.98]"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Muted Accounts Tab Content */}
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
                    placeholder="Enter username to mute..."
                    className="bg-muted/20 border-border/60 h-8 pl-8 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!muteInput.trim() || muteMutation.isPending}
                  data-cuelume-press="soft"
                  className="facet-interactive border-border/60 bg-secondary/80 text-foreground hover:bg-secondary flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold active:scale-[0.98] disabled:opacity-50"
                >
                  {muteMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <EyeOff className="text-muted-foreground h-3.5 w-3.5" />
                  )}
                  <span>Mute</span>
                </button>
              </form>

              {mutedAccounts.length === 0 ? (
                <div className="border-border/40 bg-card/20 rounded-xl border p-6 text-center">
                  <EyeOff className="text-muted-foreground/40 mx-auto mb-1.5 h-6 w-6" />
                  <p className="text-muted-foreground text-xs font-semibold">No muted accounts</p>
                  <p className="text-muted-foreground/70 mx-auto mt-0.5 max-w-sm text-[11px]">
                    Muted accounts will not appear in your feeds or notification streams without
                    them knowing.
                  </p>
                </div>
              ) : (
                <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {mutedAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="border-border/40 bg-card/40 flex items-center justify-between gap-3 rounded-xl border p-2.5 shadow-2xs"
                    >
                      <div className="min-w-0">
                        <p className="text-foreground truncate text-xs font-bold">
                          {account.label}
                        </p>
                        <p className="text-muted-foreground text-[10px]">{account.subtitle}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          unmuteMutation.mutate({ connectionId: account.id });
                        }}
                        disabled={unmuteMutation.isPending}
                        data-cuelume-press="soft"
                        className="facet-interactive border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground rounded-lg border px-2.5 py-1 text-xs font-semibold active:scale-[0.98]"
                      >
                        Unmute
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Muted Keywords Tab Content */}
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
                    placeholder="Enter word, phrase, or hashtag to filter..."
                    className="bg-muted/20 border-border/60 h-8 pl-8 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!keywordInput.trim() || addKeywordMutation.isPending}
                  data-cuelume-press="soft"
                  className="facet-interactive border-border/60 bg-secondary/80 text-foreground hover:bg-secondary flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold active:scale-[0.98] disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Word</span>
                </button>
              </form>

              {mutedKeywords.length === 0 ? (
                <div className="border-border/40 bg-card/20 rounded-xl border p-6 text-center">
                  <Filter className="text-muted-foreground/40 mx-auto mb-1.5 h-6 w-6" />
                  <p className="text-muted-foreground text-xs font-semibold">No muted keywords</p>
                  <p className="text-muted-foreground/70 mx-auto mt-0.5 max-w-sm text-[11px]">
                    Posts and notifications containing these keywords will be filtered from your
                    feed.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5 p-1">
                  {mutedKeywords.map((item) => (
                    <span
                      key={item.id}
                      className="border-border/60 bg-card/60 text-foreground inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-2xs"
                    >
                      <span>{item.keyword}</span>
                      <button
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          removeKeywordMutation.mutate({ connectionId: item.id });
                        }}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                        title="Remove keyword filter"
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

      {/* 2. Interaction & Communication Safety */}
      <SettingsGroup
        title="Interactions & Messaging Safety"
        description="Configure who can send you direct messages, tag your profile, and initiate trades."
      >
        <SettingsRow
          label="Direct Messages"
          description="Control who is permitted to send you direct messages in ThinkShare"
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
              <SelectItem value="followers">Followers Only</SelectItem>
              <SelectItem value="verified">Verified Accounts Only</SelectItem>
              <SelectItem value="nobody">Nobody</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsSwitchRow
          id="dm-filtering"
          label="Message Request Filtering"
          description="Route incoming messages from accounts you do not follow into a separate requests folder"
          icon={Filter}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.messageRequestFiltering ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ messageRequestFiltering: checked });
          }}
        />

        <SettingsRow
          label="Mentions & Tagging"
          description="Choose who can tag or mention your profile in Thinkpages posts and comments"
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
              <SelectItem value="followers">People You Follow</SelectItem>
              <SelectItem value="nobody">Nobody</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Trade & Vault Offers"
          description="Control who can send you card trade requests or vault gift transfers"
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
              <SelectItem value="followers">Followers Only</SelectItem>
              <SelectItem value="nobody">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>

        <SettingsRow
          label="Thinktank & Group Invites"
          description="Choose who is allowed to invite you to private policy thinktanks and coalitions"
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
              <SelectItem value="followers">Followers Only</SelectItem>
              <SelectItem value="nobody">Nobody</SelectItem>
            </SelectContent>
          </Select>
        </SettingsRow>
      </SettingsGroup>

      {/* 3. Discovery & Profile Privacy */}
      <SettingsGroup
        title="Profile Discovery & Visibility"
        description="Manage your appearance in search directories, online presence, and read indicators."
      >
        <SettingsSwitchRow
          id="search-discoverable"
          label="Search & Directory Discoverability"
          description="Allow your diplomat profile and national registry to appear in global search and leaderboards"
          icon={Search}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.searchDiscoverable ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ searchDiscoverable: checked });
          }}
        />

        <SettingsSwitchRow
          id="search-engine-indexing"
          label="Search Engine Indexing"
          description="Request search engines (Google, Bing) not to index your public diplomat profile page"
          icon={Globe}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.searchEngineIndexing ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ searchEngineIndexing: checked });
          }}
        />

        <SettingsSwitchRow
          id="online-status"
          label="Live Online Presence"
          description="Display when you are active on Thinkpages and browsing the interactive map"
          icon={Activity}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.showOnlineStatus ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ showOnlineStatus: checked });
          }}
        />

        <SettingsSwitchRow
          id="read-receipts"
          label="Direct Message Read Receipts"
          description="Send read indicators when you view incoming ThinkShare chat messages"
          icon={Check}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.dmReadReceipts ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ dmReadReceipts: checked });
          }}
        />
      </SettingsGroup>

      {/* 4. Connected Services & Third-Party Sync */}
      <SettingsGroup
        title="Connected Services & Sync"
        description="Manage trading card indexing and linked third-party handles."
      >
        <SettingsRow
          label="NationStates Card Deck Indexing"
          description="Remove your trading card metadata from public search indexes or unlink your deck"
          icon={NationStatesLogo}
          glyphClass="bg-muted/60 text-foreground"
        >
          <div className="flex items-center gap-2">
            <Link
              href="/settings?tab=cards"
              data-cuelume-press="soft"
              className="facet-interactive border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
            >
              Manage Deck
            </Link>
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setShowTakedownModal(true);
              }}
              data-cuelume-press="soft"
              className="facet-interactive border-border/60 bg-muted/30 text-muted-foreground flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-500 active:scale-[0.98]"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Takedown / Opt-Out</span>
            </button>
          </div>
        </SettingsRow>

        <SettingsSwitchRow
          id="show-discord-tag"
          label="Display Discord Tag on Profile"
          description="Show your connected Discord username on your public diplomat badge"
          icon={Users}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.showDiscordTag ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ showDiscordTag: checked });
          }}
        />

        <SettingsSwitchRow
          id="show-wiki-attribution"
          label="MediaWiki Author Attribution"
          description="Link your user profile to wiki articles and community lore contributions"
          icon={Globe}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.showWikiAttribution ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ showWikiAttribution: checked });
          }}
        />
      </SettingsGroup>

      {/* 5. Platform Telemetry & Personalization */}
      <SettingsGroup
        title="Platform Telemetry & Personalization"
        description="Manage diagnostic telemetry, recommendation feeds, and recent search history."
      >
        <SettingsSwitchRow
          id="diagnostic-telemetry"
          label="Anonymous Diagnostics & Performance Telemetry"
          description="Help improve IxStates stability by sending anonymous error reports and load metrics"
          icon={Activity}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.diagnosticTelemetry ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ diagnosticTelemetry: checked });
          }}
        />

        <SettingsSwitchRow
          id="personalized-recommendations"
          label="Personalized Recommendations"
          description="Allow your collection, viewing history, and topic engagement to tailor trending recommendations"
          icon={Sparkles}
          glyphClass="bg-muted/60 text-foreground"
          checked={config?.personalizedRecommendations ?? true}
          onCheckedChange={(checked) => {
            updateConfigMutation.mutate({ personalizedRecommendations: checked });
          }}
        />

        <SettingsRow
          label="Search & Browsing History"
          description="Clear your locally cached search suggestions and recently visited nation profiles"
          icon={Trash}
          glyphClass="bg-muted/60 text-foreground"
        >
          <button
            type="button"
            onClick={() => {
              soundEffects.press();
              clearHistoryMutation.mutate();
            }}
            disabled={clearHistoryMutation.isPending}
            data-cuelume-press="soft"
            className="facet-interactive border-border/60 bg-muted/40 text-muted-foreground hover:bg-muted/70 hover:text-foreground rounded-xl border px-3 py-1.5 text-xs font-semibold active:scale-[0.98]"
          >
            Clear History
          </button>
        </SettingsRow>
      </SettingsGroup>

      {/* 6. Security & Data Governance */}
      <SettingsGroup
        title="Security & Data Governance"
        description="Export personal archives, manage active sign-in sessions, and configure security credentials."
      >
        <SettingsRow
          label="Export Account Data Archive"
          description="Download a complete JSON export of your country data, card collection, and account records"
          icon={Download}
          glyphClass="bg-muted/60 text-foreground"
        >
          <button
            type="button"
            onClick={handleExportData}
            disabled={isExporting}
            data-cuelume-press="soft"
            className="facet-interactive border-border/60 bg-secondary/80 text-foreground hover:bg-secondary flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>{isExporting ? "Generating..." : "Download Archive"}</span>
          </button>
        </SettingsRow>

        <SettingsRow
          label="Active Sessions & Two-Factor Authentication"
          description="Manage signed-in devices, active web sessions, and passkeys via your security profile"
          icon={Lock}
          glyphClass="bg-muted/60 text-foreground"
        >
          <button
            type="button"
            onClick={() => {
              soundEffects.press();
              clerk.openUserProfile();
            }}
            data-cuelume-press="soft"
            className="facet-interactive border-border/60 bg-secondary/80 text-foreground hover:bg-secondary flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all active:scale-[0.98]"
          >
            <KeyIcon className="text-muted-foreground h-3.5 w-3.5" />
            <span>Security Profile</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </button>
        </SettingsRow>
      </SettingsGroup>

      {/* NationStates Card Takedown & Opt-Out Modal */}
      <NSTakedownModal
        isOpen={showTakedownModal}
        onClose={() => setShowTakedownModal(false)}
        defaultNationName={userProfile?.country?.name ?? ""}
      />
    </div>
  );
}
