"use client";

import React from "react";
import Link from "next/link";
import {
  Compass,
  BookmarkBook,
  User,
  Shuffle,
  Folder,
  MediaImage,
  Link as LinkIcon,
  RssFeed,
  ArrowRight,
} from "iconoir-react";

import { withBasePath } from "~/lib/base-path";

interface DiscoverySectionProps {
  searchFilter: string;
}

export function DiscoverySection({ searchFilter }: DiscoverySectionProps) {
  const query = searchFilter.toLowerCase().trim();

  const tools = [
    {
      id: "recent-changes",
      title: "Recent Changes & Revision Stream",
      description: "Live feed of recent edits, creations, and article revisions across the realm.",
      legacyAlias: "Special:RecentChanges",
      icon: Compass,
      href: "/wiki/recent-changes",
      badge: "Real-Time",
      color: "from-blue-500/10 to-indigo-500/10 text-blue-400 border-blue-500/20",
    },
    {
      id: "watchlist",
      title: "Personal Watchlist & Stash Feed",
      description: "Follow changes to your curated lore articles, bookmarks, and starred entities.",
      legacyAlias: "Special:Watchlist",
      icon: BookmarkBook,
      href: "/stashes",
      badge: "Stash Integrated",
      color: "from-amber-500/10 to-orange-500/10 text-amber-400 border-amber-500/20",
    },
    {
      id: "contributions",
      title: "User Contributions Ledger",
      description: "Audit edits, creations, and revision summaries by editor identity or username.",
      legacyAlias: "Special:Contributions",
      icon: User,
      href: "/wiki/contributions",
      badge: "Identity",
      color: "from-emerald-500/10 to-teal-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      id: "random",
      title: "Random Lore Sprout",
      description: "Explore the encyclopedia serendipitously with uniform random article hops.",
      legacyAlias: "Special:Random",
      icon: Shuffle,
      href: "/wiki/random",
      badge: "Serendipity",
      color: "from-purple-500/10 to-pink-500/10 text-purple-400 border-purple-500/20",
    },
    {
      id: "categories",
      title: "Taxonomy & Category Graph",
      description: "Traverse hierarchical category branches, namespaces, and subtopic trees.",
      legacyAlias: "Special:Categories",
      icon: Folder,
      href: "/wiki/categories",
      badge: "Taxonomy",
      color: "from-cyan-500/10 to-sky-500/10 text-cyan-400 border-cyan-500/20",
    },
    {
      id: "media-commons",
      title: "Media Assets Commons",
      description: "Inspect 7,555+ edge-cached images, flags, diagrams, and asset citations.",
      legacyAlias: "Special:ListFiles",
      icon: MediaImage,
      href: "/wiki/repository",
      badge: "7,555 Assets",
      color: "from-rose-500/10 to-pink-500/10 text-rose-400 border-rose-500/20",
    },
    {
      id: "backlinks",
      title: "Backlinks & Directed Link Graph",
      description: "Query incoming connections, inbound citations, and 'What Links Here' relations in O(1).",
      legacyAlias: "Special:WhatLinksHere",
      icon: LinkIcon,
      href: "/wiki/whatlinkshere",
      badge: "O(1) Graph",
      color: "from-amber-500/10 to-yellow-500/10 text-amber-400 border-amber-500/20",
    },
    {
      id: "feeds",
      title: "Atom & JSON Syndication Feeds",
      description: "Standards-compliant RSS/Atom XML feeds for RSS readers and external webhooks.",
      legacyAlias: "Special:Feed",
      icon: RssFeed,
      href: "/api/wiki/feed/recent-changes.atom",
      isExternal: true,
      badge: "Atom 1.0",
      color: "from-orange-500/10 to-red-500/10 text-orange-400 border-orange-500/20",
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
        <Compass className="h-4 w-4 text-blue-400" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Discovery & Syndication ({filtered.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.id}
              href={withBasePath(tool.href)}
              target={tool.isExternal ? "_blank" : undefined}
              rel={tool.isExternal ? "noreferrer" : undefined}
              data-cuelume-press="press"
              data-cuelume-hover="tick"
              className="group relative flex flex-col justify-between rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-wiki/40 hover:bg-card/90 hover:shadow-lg active:scale-[0.98]"
            >
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-gradient-to-br ${tool.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="rounded-full border border-border/40 bg-secondary/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {tool.badge}
                  </span>
                </div>

                <h4 className="text-sm font-semibold text-foreground group-hover:text-wiki">
                  {tool.title}
                </h4>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {tool.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/30 pt-3 text-[11px] text-muted-foreground">
                <span className="font-mono text-[10px] opacity-70">{tool.legacyAlias}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-wiki" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
