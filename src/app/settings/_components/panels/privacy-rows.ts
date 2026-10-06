import type React from "react";
import {
  ChatBubble,
  AtSign,
  RefreshDouble,
  Search,
  Group as Users,
  Filter,
  Activity,
  DoubleCheck,
  Globe,
  Discord,
  OpenBook,
} from "iconoir-react";
import type { PrivacyConfig } from "~/server/api/routers/users/preferences";

/**
 * The Privacy & Security panel's audience selects and switches. Every key is enforced on the
 * server (SL-4); docs/systems/settings.md lists what each does.
 */
type Icon = React.ComponentType<{ className?: string }>;

export interface SelectRowSpec {
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

export const SELECT_ROWS: SelectRowSpec[] = [
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

export interface SwitchRowSpec {
  key: {
    [K in keyof PrivacyConfig]: PrivacyConfig[K] extends boolean ? K : never;
  }[keyof PrivacyConfig];
  id: string;
  label: string;
  description: string;
  icon: Icon;
}

export const INTERACTION_SWITCH_ROWS: SwitchRowSpec[] = [
  {
    key: "messageRequestFiltering",
    id: "message-requests",
    label: "Message requests",
    description:
      "Messages from people outside your direct-message audience go to Requests instead of being refused",
    icon: Filter,
  },
];

export const ACTIVITY_ROWS: SwitchRowSpec[] = [
  {
    key: "showOnlineStatus",
    id: "online-status",
    label: "Online status",
    description: "Show others when you are active, in Messages and on your passport",
    icon: Activity,
  },
  {
    key: "dmReadReceipts",
    id: "read-receipts",
    label: "Read receipts",
    description: "Show Seen in direct conversations. You only see others' when you share yours",
    icon: DoubleCheck,
  },
];

export const DISCOVERY_ROWS: SwitchRowSpec[] = [
  {
    key: "searchDiscoverable",
    id: "search-discoverable",
    label: "Appear in invite search",
    description: "Let ThinkTank owners find you by name when inviting members",
    icon: Search,
  },
  {
    key: "searchEngineIndexing",
    id: "search-engine-indexing",
    label: "Search engine indexing",
    description: "Let search engines such as Google and Bing index your public passport",
    icon: Globe,
  },
];

export const LINKED_NAME_ROWS: SwitchRowSpec[] = [
  {
    key: "showDiscordTag",
    id: "show-discord-tag",
    label: "Show Discord tag",
    description: "Show your linked Discord username on your passport and in activity",
    icon: Discord,
  },
  {
    key: "showWikiAttribution",
    id: "show-wiki-attribution",
    label: "Wiki attribution",
    description: "Link your wiki name, articles and Lorewards to your passport and country",
    icon: OpenBook,
  },
];
