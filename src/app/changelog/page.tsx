import { type Metadata } from "next";
import { PLATFORM_VERSION, RELEASE_NAME, CHANNEL, CHANNEL_CONFIG } from "~/lib/buildVersion";
import { Badge, type BadgeVariant } from "~/components/ui/badge";
import { ChangelogFeed, type Release } from "./_components/ChangelogFeed";
import { PageHeader } from "~/components/shell/PageHeader";
import { MarkVersionSeen } from "./_components/MarkVersionSeen";

export const metadata: Metadata = {
  title: "Changelog | IxStates",
  description: "Platform features, simulation updates, engine upgrades and fixes.",
};

// The public changelog starts at the 1.0 reveal. The internal history (1.3 to 1.5) stays in CHANGELOG.md.
const RELEASES: Release[] = [
  {
    version: PLATFORM_VERSION,
    releaseName: RELEASE_NAME,
    date: "October 2026",
    channel: CHANNEL,
    isCurrent: true,
    tagline:
      "IxStates opens to everyone: run a nation, shape a living world, and read and write its history in one place.",
    items: [
      {
        id: "v1-mycountry",
        category: "feature",
        title: "MyCountry",
        description:
          "Run your nation from one executive command center: its economy, government, defense and diplomacy, on the shared IxTime clock.",
        highlights: [
          "A country builder that walks you from founding to a full government",
          "Statecraft policies that move your economy and your standing",
          "A starter force sized to your nation, ready on your first visit",
        ],
        link: { href: "/mycountry", label: "Open MyCountry" },
      },
      {
        id: "v1-ixworld",
        category: "feature",
        title: "IxWorld maps",
        description:
          "An interactive globe of every realm: borders, terrain, rivers and cities, with tools for drawing your own nation's map.",
        link: { href: "/maps", label: "Open the map" },
      },
      {
        id: "v1-realms",
        category: "feature",
        title: "Realms",
        description:
          "Worlds with their own nations, maps, boards and clocks. Ixnay is home; Eurth is the first realm beyond it.",
        link: { href: "/realms", label: "Browse realms" },
      },
      {
        id: "v1-wikios",
        category: "feature",
        title: "WikiOS",
        description:
          "Read IxWiki inside IxStates, with hover previews, saved articles and your nation's lore beside its numbers.",
        link: { href: "/wiki", label: "Open WikiOS" },
      },
      {
        id: "v1-vault",
        category: "feature",
        title: "The Vault",
        description:
          "Your wallet, daily rewards, achievements, cards and the store, in one place for every player.",
        highlights: [
          "IxCredits earned through play",
          "Collectible cards of nations, lore and Lorewards trophies",
          "Achievements across your nation, the wiki and the community",
        ],
        link: { href: "/vault", label: "Open the Vault" },
      },
      {
        id: "v1-thinkpages",
        category: "feature",
        title: "ThinkPages and messages",
        description:
          "The community's forum and social feed, with direct messages and live activity from across the world.",
        link: { href: "/thinkpages", label: "Open ThinkPages" },
      },
    ],
  },
];

/** Release channel to badge tone: stable is settled, pre-release channels warn. */
const CHANNEL_BADGE: Record<string, BadgeVariant> = {
  stable: "success",
  rc: "info",
  beta: "info",
  alpha: "warning",
  developer: "secondary",
};

export default function ChangelogPage() {
  const channelTheme = CHANNEL_CONFIG[CHANNEL] ?? CHANNEL_CONFIG.Stable;

  return (
    <div className="text-label">
      <MarkVersionSeen />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="What's new in IxStates"
          back={{ href: "/dashboard", label: "Dashboard" }}
          actions={
            <Badge
              variant={CHANNEL_BADGE[channelTheme.status] ?? "secondary"}
              className="tabular-nums"
            >
              v{PLATFORM_VERSION} · {RELEASE_NAME} ({channelTheme.shortName})
            </Badge>
          }
        />

        <ChangelogFeed releases={RELEASES} />
      </div>
    </div>
  );
}
