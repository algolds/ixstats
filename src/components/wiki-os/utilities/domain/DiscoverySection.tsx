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
      href: "/util/recent-changes",
      badge: "Real-Time",
      color: "border-blue/20 bg-blue/10 text-blue",
    },
    {
      id: "watchlist",
      title: "Personal Watchlist & Stash Feed",
      description: "Follow changes to your curated lore articles, bookmarks, and starred entities.",
      legacyAlias: "Special:Watchlist",
      icon: BookmarkBook,
      href: "/stashes",
      badge: "Stash Integrated",
      color: "border-yellow/20 bg-yellow/10 text-yellow",
    },
    {
      id: "contributions",
      title: "User Contributions Ledger",
      description: "Audit edits, creations, and revision summaries by editor identity or username.",
      legacyAlias: "Special:Contributions",
      icon: User,
      href: "/util/contributions",
      badge: "Identity",
      color: "border-green/20 bg-green/10 text-green",
    },
    {
      id: "random",
      title: "Random Lore Sprout",
      description: "Explore the encyclopedia serendipitously with uniform random article hops.",
      legacyAlias: "Special:Random",
      icon: Shuffle,
      href: "/util/random",
      badge: "Serendipity",
      color: "border-indigo/20 bg-indigo/10 text-indigo",
    },
    {
      id: "categories",
      title: "Taxonomy & Category Graph",
      description: "Traverse hierarchical category branches, namespaces, and subtopic trees.",
      legacyAlias: "Special:Categories",
      icon: Folder,
      href: "/util/categories",
      badge: "Taxonomy",
      color: "border-teal/20 bg-teal/10 text-teal",
    },
    {
      id: "media-commons",
      title: "Media Assets Commons",
      description: "Inspect 7,555+ edge-cached images, flags, diagrams, and asset citations.",
      legacyAlias: "Special:ListFiles",
      icon: MediaImage,
      href: "/util/repository",
      badge: "7,555 Assets",
      color: "border-blue/20 bg-blue/10 text-blue",
    },
    {
      id: "backlinks",
      title: "Backlinks & Directed Link Graph",
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
      title: "Atom & JSON Syndication Feeds",
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
              className="group border-separator bg-surface hover:border-tint/40 hover:bg-surface rounded-row hover:shadow-floating relative flex flex-col justify-between border p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
            >
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div
                    className={`rounded-control flex h-9 w-9 items-center justify-center border ${tool.color}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="border-separator bg-fill-3 text-label-secondary text-caption rounded-full border px-2 py-0.5">
                    {tool.badge}
                  </span>
                </div>

                <h4 className="text-label group-hover:text-tint text-headline">{tool.title}</h4>
                <p className="text-label-secondary text-footnote mt-1 line-clamp-2">
                  {tool.description}
                </p>
              </div>

              <div className="border-separator text-label-secondary text-footnote mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-footnote tabular-nums opacity-70">{tool.legacyAlias}</span>
                <ArrowRight className="text-label-secondary group-hover:text-tint h-3 w-3 transition-transform duration-200 group-hover:translate-x-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
