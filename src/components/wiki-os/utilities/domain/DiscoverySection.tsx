"use client";

import React from "react";
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

import { UtilityToolCard } from "./UtilityToolCard";

interface DiscoverySectionProps {
  searchFilter: string;
}

export function DiscoverySection({ searchFilter }: DiscoverySectionProps) {
  const query = searchFilter.toLowerCase().trim();

  const tools = [
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

  const filtered = tools.filter(
    (t) =>
      !query ||
      t.title.toLowerCase().includes(query) ||
      t.description.toLowerCase().includes(query) ||
      t.legacyAlias.toLowerCase().includes(query)
  );

  if (filtered.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <Compass className="text-tint h-4 w-4" />
        <h3 className="text-label-secondary text-subhead">
          Discovery & Syndication ({filtered.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((tool) => (
          <UtilityToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
