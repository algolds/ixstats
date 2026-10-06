"use client";

import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import React, { useState } from "react";
import Link from "next/link";
import {
  UserXmark,
  ChatBubble,
  AtSign,
  RefreshDouble,
  Text as TextIcon,
  EyeClosed as EyeOff,
  Download,
  Lock,
  Key as KeyIcon,
  ShieldAlert,
  OpenNewWindow as ExternalLink,
  SystemRestart as Loader2,
  Search,
  Group as Users,
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

/*
 * Only settings the server enforces are shown (SL-4): blocking, muting and muted words, who may
 * message you, mention you, send you trade offers and invite you to ThinkTanks, and appearing in
 * ThinkTank invite search (src/server/shared/privacy-permissions.ts, user-blocks.ts). The other
 * PrivacyConfig keys (message request filtering, online status, read receipts, indexing,
 * telemetry, recommendations, Discord tag, wiki attribution) and "clear history" have nothing
 * behind them yet, so they are hidden.
 */
type FilterTab = "blocked" | "muted" | "keywords";
type Icon = React.ComponentType<{ className?: string }>;
type FilterAccount = {
  id: string;
  label: string;
  subtitle?: string | null;
  avatarUrl?: string | null;
};

const GLYPH = "bg-muted/60 text-foreground";

interface SelectRowSpec {
  key: "directMessages" | "mentions" | "tradeOffers" | "thinktankInvites";
  label: string;
  description: string;
  icon: Icon;
  options: Array<[value: string, label: string]>;
}

const AUDIENCE_OPTIONS: Array<[value: string, label: string]> = [
  ["everyone", "Everyone"],
  ["followers", "People you follow"],
  ["nobody", "Nobody"],
];

const SELECT_ROWS: SelectRowSpec[] = [
  {
    key: "directMessages",
    label: "Direct messages",
    description: "Who can start a conversation with you or message you directly",
    icon: ChatBubble,
    options: AUDIENCE_OPTIONS,
  },
  {
    key: "mentions",
    label: "Mentions",
    description: "Whose @mentions notify you (the mention still shows on the post)",
    icon: AtSign,
    options: AUDIENCE_OPTIONS,
  },
  {
    key: "tradeOffers",
    label: "Card trade offers",
    description: "Who can send you a card trade offer",
    icon: RefreshDouble,
    options: AUDIENCE_OPTIONS,
  },
  {
    key: "thinktankInvites",
    label: "ThinkTank invites",
    description: "Who can invite you to private ThinkTanks",
    icon: Users,
    options: [
      ["everyone", "Everyone"],
      ["followers", "Followers only"],
      ["nobody", "Nobody"],
    ],
  },
];

interface SwitchRowSpec {
  key: "searchDiscoverable";
  id: string;
  label: string;
  description: string;
  icon: Icon;
}

const DISCOVERY_ROWS: SwitchRowSpec[] = [
  {
    key: "searchDiscoverable",
    id: "search-discoverable",
    label: "Appear in invite search",
    description: "Let ThinkTank owners find you by name when inviting members",
    icon: Search,
  },
];

function FilterForm(props: {
  icon: Icon;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onSubmit: (value: string) => void;
  pending: boolean;
  buttonIcon: React.ReactNode;
  buttonLabel: string;
}) {
  const value = props.value.trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value) {
          soundEffects.press();
          props.onSubmit(value);
        }
      }}
      className="flex items-center gap-2"
    >
      <div className="relative flex-1">
        <props.icon className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        <Input
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          className="bg-muted/20 border-border/60 h-8 pl-8 text-xs"
        />
      </div>
      <Button
        type="submit"
        disabled={!value || props.pending}
        data-cuelume-press="soft"
        variant="secondary"
        size="sm"
      >
        {props.pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : props.buttonIcon}
        <span>{props.buttonLabel}</span>
      </Button>
    </form>
  );
}

function EmptyListNotice({ icon: Icon, title, text }: { icon: Icon; title: string; text: string }) {
  return (
    <div className="border-separator rounded-row border p-6 text-center">
      <Icon className="text-muted-foreground/40 mx-auto mb-1.5 h-6 w-6" />
      <p className="text-muted-foreground text-xs font-semibold">{title}</p>
      <p className="text-muted-foreground/70 mx-auto mt-0.5 max-w-sm text-xs">{text}</p>
    </div>
  );
}

function AccountList(props: {
  accounts: FilterAccount[];
  actionLabel: string;
  onAction: (id: string) => void;
  pending: boolean;
  showAvatar?: boolean;
}) {
  return (
    <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
      {props.accounts.map((account) => (
        <div
          key={account.id}
          className="border-separator bg-surface-secondary rounded-row flex items-center justify-between gap-3 border p-2.5"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            {props.showAvatar && (
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
            )}
            <div className="min-w-0">
              <p className="text-foreground truncate text-xs font-bold">{account.label}</p>
              <p className="text-muted-foreground text-xs">{account.subtitle}</p>
            </div>
          </div>

          <Button
            type="button"
            onClick={() => {
              soundEffects.press();
              props.onAction(account.id);
            }}
            disabled={props.pending}
            data-cuelume-press="soft"
            variant="secondary"
            size="sm"
          >
            {props.actionLabel}
          </Button>
        </div>
      ))}
    </div>
  );
}

function BlockingFilters(props: {
  blockedAccounts: FilterAccount[];
  mutedAccounts: FilterAccount[];
  mutedKeywords: FilterAccount[];
}) {
  const { blockedAccounts, mutedAccounts, mutedKeywords } = props;
  const notify = useNotify();
  const utils = api.useUtils();

  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>("blocked");
  const [inputs, setInputs] = useState<Record<FilterTab, string>>({
    blocked: "",
    muted: "",
    keywords: "",
  });
  const setInput = (tab: FilterTab) => (value: string) =>
    setInputs((prev) => ({ ...prev, [tab]: value }));

  /** Success: sound + toast + refresh the lists; failure: error sound + toast. */
  const listMutation = (
    success: string,
    failure: string,
    sound: "bloom" | "press",
    afterSuccess?: () => void
  ) => ({
    onSuccess: () => {
      soundEffects[sound]();
      notify.success(success);
      afterSuccess?.();
      void utils.users.getPrivacySettings.invalidate();
    },
    onError: (err: { message?: string }) => {
      soundEffects.error();
      notify.error(err.message || failure);
    },
  });

  const blockMutation = api.users.blockAccount.useMutation(
    listMutation("Account added to blocklist", "Failed to block account", "bloom", () =>
      setInput("blocked")("")
    )
  );
  const unblockMutation = api.users.unblockAccount.useMutation(
    listMutation("Account removed from blocklist", "Failed to unblock account", "press")
  );
  const muteMutation = api.users.muteAccount.useMutation(
    listMutation("Account muted", "Failed to mute account", "bloom", () => setInput("muted")(""))
  );
  const unmuteMutation = api.users.unmuteAccount.useMutation(
    listMutation("Account unmuted", "Failed to unmute account", "press")
  );
  const addKeywordMutation = api.users.addMutedKeyword.useMutation(
    listMutation("Word muted", "Failed to mute word", "bloom", () => setInput("keywords")(""))
  );
  const removeKeywordMutation = api.users.removeMutedKeyword.useMutation(
    listMutation("Word unmuted", "Failed to unmute word", "press")
  );

  return (
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

      {activeFilterTab === "blocked" && (
        <div className="space-y-3">
          <FilterForm
            icon={Search}
            value={inputs.blocked}
            onChange={setInput("blocked")}
            placeholder="Username or country name to block"
            onSubmit={(identifier) => blockMutation.mutate({ identifier })}
            pending={blockMutation.isPending}
            buttonIcon={<UserXmark className="h-3.5 w-3.5 text-rose-500" />}
            buttonLabel="Block"
          />
          {blockedAccounts.length === 0 ? (
            <EmptyListNotice
              icon={UserXmark}
              title="No blocked accounts"
              text="Blocked accounts cannot message you or invite you to ThinkTanks, and their posts leave your ThinkPages feed."
            />
          ) : (
            <AccountList
              accounts={blockedAccounts}
              actionLabel="Unblock"
              onAction={(connectionId) => unblockMutation.mutate({ connectionId })}
              pending={unblockMutation.isPending}
              showAvatar
            />
          )}
        </div>
      )}

      {activeFilterTab === "muted" && (
        <div className="space-y-3">
          <FilterForm
            icon={Search}
            value={inputs.muted}
            onChange={setInput("muted")}
            placeholder="Username to mute"
            onSubmit={(identifier) => muteMutation.mutate({ identifier })}
            pending={muteMutation.isPending}
            buttonIcon={<EyeOff className="text-muted-foreground h-3.5 w-3.5" />}
            buttonLabel="Mute"
          />
          {mutedAccounts.length === 0 ? (
            <EmptyListNotice
              icon={EyeOff}
              title="No muted accounts"
              text="Posts by muted accounts are hidden from your ThinkPages feed, and they are not told."
            />
          ) : (
            <AccountList
              accounts={mutedAccounts}
              actionLabel="Unmute"
              onAction={(connectionId) => unmuteMutation.mutate({ connectionId })}
              pending={unmuteMutation.isPending}
            />
          )}
        </div>
      )}

      {activeFilterTab === "keywords" && (
        <div className="space-y-3">
          <FilterForm
            icon={TextIcon}
            value={inputs.keywords}
            onChange={setInput("keywords")}
            placeholder="Word or phrase to mute"
            onSubmit={(keyword) => addKeywordMutation.mutate({ keyword })}
            pending={addKeywordMutation.isPending}
            buttonIcon={<EyeOff className="text-muted-foreground h-3.5 w-3.5" />}
            buttonLabel="Mute"
          />
          {mutedKeywords.length === 0 ? (
            <EmptyListNotice
              icon={TextIcon}
              title="No muted words"
              text="Posts containing a muted word are hidden from your ThinkPages, activity and Following feeds."
            />
          ) : (
            <AccountList
              accounts={mutedKeywords}
              actionLabel="Unmute"
              onAction={(connectionId) => removeKeywordMutation.mutate({ connectionId })}
              pending={removeKeywordMutation.isPending}
            />
          )}
        </div>
      )}
    </div>
  );
}

function SecurityAndDataGroup() {
  const notify = useNotify();
  const clerk = useClerk();
  const [isExporting, setIsExporting] = useState(false);
  const { refetch: fetchExportData } = api.users.exportUserData.useQuery(undefined, {
    enabled: false,
  });

  const handleExportData = async () => {
    try {
      setIsExporting(true);
      soundEffects.press();
      const { data } = await fetchExportData();
      if (!data) throw new Error("The export returned no data");

      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      );
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

  return (
    <SettingsGroup
      title="Security and data"
      description="Export your data and manage sessions and credentials."
    >
      <SettingsRow
        label="Export your data"
        description="Download a JSON export of your country data, card collection and account records"
        icon={Download}
        glyphClass={GLYPH}
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
        glyphClass={GLYPH}
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
  );
}

export function PrivacySecurityPanel() {
  const notify = useNotify();
  const utils = api.useUtils();
  const [showTakedownModal, setShowTakedownModal] = useState(false);

  const { data: privacyData } = api.users.getPrivacySettings.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  // Optimistic update of the privacy config
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

  const config = privacyData?.config;
  const blockedAccounts = privacyData?.blockedAccounts ?? [];
  const mutedAccounts = privacyData?.mutedAccounts ?? [];
  const mutedKeywords = (privacyData?.mutedKeywords ?? []).map((k) => ({
    id: k.id,
    label: k.keyword,
  }));

  const setOption = <K extends keyof PrivacyConfig>(key: K, value: PrivacyConfig[K]) =>
    updateConfigMutation.mutate({ [key]: value } as Partial<PrivacyConfig>);

  const renderSwitchRows = (rows: SwitchRowSpec[]) =>
    rows.map((row) => (
      <SettingsSwitchRow
        key={row.id}
        id={row.id}
        label={row.label}
        description={row.description}
        icon={row.icon}
        glyphClass={GLYPH}
        checked={config?.[row.key] ?? true}
        onCheckedChange={(checked) => setOption(row.key, checked)}
      />
    ));

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Privacy & Security"
        category="Platform & preferences"
        description="Blocking, muting, who can reach you, invite search and your data."
      />

      <SettingsGroup
        title="Blocking and muting"
        description="Stop accounts from messaging you, and keep accounts and words out of your feeds."
      >
        <BlockingFilters
          blockedAccounts={blockedAccounts}
          mutedAccounts={mutedAccounts}
          mutedKeywords={mutedKeywords}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Interactions"
        description="Who can message, mention, trade with and invite you."
      >
        {SELECT_ROWS.map((row) => (
          <React.Fragment key={row.key}>
            <SettingsRow
              label={row.label}
              description={row.description}
              icon={row.icon}
              glyphClass={GLYPH}
            >
              <Select
                value={config?.[row.key] ?? "everyone"}
                onValueChange={(val) => {
                  soundEffects.press();
                  setOption(row.key, val as PrivacyConfig[typeof row.key]);
                }}
              >
                <SelectTrigger
                  size="sm"
                  className="border-border/60 bg-muted/40 text-foreground w-[180px] rounded-xl text-xs font-semibold"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {row.options.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>
          </React.Fragment>
        ))}
      </SettingsGroup>

      <SettingsGroup title="Discovery" description="Whether others can find you by name.">
        {renderSwitchRows(DISCOVERY_ROWS)}
      </SettingsGroup>

      <SettingsGroup title="Connected services" description="Trading card indexing.">
        <SettingsRow
          label="NationStates card deck"
          description="Remove your card data from public search or unlink your deck"
          icon={NationStatesLogo}
          glyphClass={GLYPH}
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
      </SettingsGroup>

      <SecurityAndDataGroup />

      <NSTakedownModal
        isOpen={showTakedownModal}
        onClose={() => setShowTakedownModal(false)}
        defaultNationName={userProfile?.country?.name ?? ""}
      />
    </div>
  );
}
