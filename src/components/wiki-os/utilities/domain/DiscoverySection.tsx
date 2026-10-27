"use client";

import {
  Compass,
  BookmarkBook,
  User,
  Shuffle,
  Folder,
  MediaImage,
  Link as LinkIcon,
  RssFeed,
} from "iconoir-react";

import { UtilityToolGroup, type UtilityTool } from "./UtilityToolCard";

const TOOLS: UtilityTool[] = [
  {
    id: "recent-changes",
    title: "Recent changes & revision stream",
    description: "Live feed of recent edits, creations, and article revisions across the realm.",
    legacyAlias: "Special:RecentChanges",
    icon: Compass,
    href: "/util/recent-changes",
    badge: "Live",
    color: "border-blue/20 bg-blue/10 text-blue",
  },
  {
    id: "watchlist",
    title: "Personal watchlist & stash feed",
    description: "Follow changes to your curated lore articles, bookmarks, and starred entities.",
    legacyAlias: "Special:Watchlist",
    icon: BookmarkBook,
    href: "/stashes",
    badge: "Stash integrated",
    color: "border-yellow/20 bg-yellow/10 text-yellow",
  },
  {
    id: "contributions",
    title: "User contributions ledger",
    description: "Audit edits, creations, and revision summaries by editor identity or username.",
    legacyAlias: "Special:Contributions",
    icon: User,
    href: "/util/contributions",
    badge: "Identity",
    color: "border-green/20 bg-green/10 text-green",
  },
  {
    id: "random",
    title: "Random lore sprout",
    description: "Explore the encyclopedia serendipitously with uniform random article hops.",
    legacyAlias: "Special:Random",
    icon: Shuffle,
    href: "/util/random",
    badge: "Serendipity",
    color: "border-indigo/20 bg-indigo/10 text-indigo",
  },
  {
    id: "categories",
    title: "Taxonomy & category graph",
    description: "Traverse hierarchical category branches, namespaces, and subtopic trees.",
    legacyAlias: "Special:Categories",
    icon: Folder,
    href: "/util/categories",
    badge: "Taxonomy",
    color: "border-teal/20 bg-teal/10 text-teal",
  },
  {
    id: "media-commons",
    title: "Media assets Commons",
    description: "Inspect 7,555+ edge-cached images, flags, diagrams, and asset citations.",
    legacyAlias: "Special:ListFiles",
    icon: MediaImage,
    href: "/util/repository",
    badge: "7,555 Assets",
    color: "border-blue/20 bg-blue/10 text-blue",
  },
  {
    id: "backlinks",
    title: "Backlinks & directed link graph",
    description:
      "Query incoming connections, inbound citations, and 'What Links Here' relations in O(1).",
    legacyAlias: "Special:WhatLinksHere",
    icon: LinkIcon,
    href: "/util/whatlinkshere",
    badge: "O(1) Graph",
    color: "border-teal/20 bg-teal/10 text-teal",
  },
  {
    id: "feeds",
    title: "Atom & JSON syndication feeds",
    description: "Standards-compliant RSS/Atom XML feeds for RSS readers and external webhooks.",
    legacyAlias: "Special:Feed",
    icon: RssFeed,
    href: "/api/wiki/feed/recent-changes.atom",
    isExternal: true,
    badge: "Atom 1.0",
    color: "border-yellow/20 bg-yellow/10 text-yellow",
  },
];

export function DiscoverySection({ searchFilter }: { searchFilter: string }) {
  return (
    <UtilityToolGroup
      icon={<Compass className="text-tint h-4 w-4" />}
      heading="Discovery & Syndication"
      tools={TOOLS}
      searchFilter={searchFilter}
      gridClass="sm:grid-cols-2 lg:grid-cols-4"
    />
  );
}
