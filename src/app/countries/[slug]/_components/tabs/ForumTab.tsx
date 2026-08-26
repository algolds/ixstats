"use client";

import React from "react";
import Link from "next/link";
import {
  ChatBubble as MessageSquare,
  Heart,
  Trophy,
  Calendar,
  Shield,
  OpenNewWindow as ExternalLink,
  Spark as Sparkles,
  Component as Layers,
} from "iconoir-react";
import { FacetCard } from "~/components/ui/facet-container";
import { FacetMetricTile } from "~/components/profile/FacetMetricTile";

export interface ForumTabData {
  linked: boolean;
  userId: number | null;
  username: string | null;
  userTitle: string | null;
  avatarUrl: string | null;
  isStaff: boolean;
  messageCount: number;
  reactionScore: number;
  trophyPoints: number;
  joinedDate: number | null;
  location: string | null;
  aboutHtml: string | null;
  customFields: Record<string, string> | null;
}

interface ForumTabProps {
  forum: ForumTabData;
  username?: string;
  isOwnCountry?: boolean;
}

function formatDate(unixTimestamp: number | null | undefined): string {
  if (!unixTimestamp) return "Unknown";
  return new Date(unixTimestamp * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ForumTab({ forum, username: fallbackName, isOwnCountry }: ForumTabProps) {
  const username = forum.username || fallbackName || "Forum Member";

  if (!forum.linked && !forum.userId && !forum.username) {
    return (
      <FacetCard depth={1} className="p-8 sm:p-12 text-center backdrop-blur-xl border border-black/8 dark:border-white/10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-500 shadow-inner">
          <MessageSquare className="h-7 w-7" />
        </div>
        <h3 className="text-foreground text-lg font-extrabold tracking-tight">No Forum Account Linked</h3>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md text-xs leading-relaxed">
          This profile has not connected a XenForo community forum account.
        </p>
        {isOwnCountry && (
          <div className="mt-6">
            <Link
              href="/settings#ixnayid-section"
              data-cuelume-press="soft"
              className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/20 transition-all hover:bg-orange-700 active:scale-95 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Link XenForo in Settings</span>
            </Link>
          </div>
        )}
      </FacetCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Forum Stats Bento Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <FacetMetricTile
          label="Messages"
          value={forum.messageCount}
          icon={<MessageSquare className="h-4 w-4" />}
          accentColor="#f97316"
        />
        <FacetMetricTile
          label="Reactions"
          value={forum.reactionScore}
          icon={<Heart className="h-4 w-4" />}
          accentColor="#f43f5e"
        />
        <FacetMetricTile
          label="Trophies"
          value={forum.trophyPoints}
          icon={<Trophy className="h-4 w-4" />}
          accentColor="#f59e0b"
        />
        <FacetMetricTile
          label="Joined"
          value={formatDate(forum.joinedDate)}
          icon={<Calendar className="h-4 w-4" />}
          accentColor="#0284c7"
        />
      </div>

      {/* Member About & Biography Bento */}
      <FacetCard depth={1} className="p-6 backdrop-blur-xl border border-black/8 dark:border-white/10">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-950 dark:text-white">
            Member Bio & Signature
          </h3>
          {forum.userId && (
            <Link
              href={`/forum/members/${forum.userId}`}
              className="flex items-center gap-1 text-xs font-bold text-orange-500 hover:underline"
            >
              <span>XenForo Profile</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>

        {forum.aboutHtml ? (
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed text-stone-600 dark:text-stone-300"
            dangerouslySetInnerHTML={{ __html: forum.aboutHtml }}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-6 text-center">
            <p className="text-xs text-stone-500 italic">
              No member biography or signature provided.
            </p>
          </div>
        )}
      </FacetCard>

      {/* Synced Custom Fields */}
      {forum.customFields && Object.keys(forum.customFields).length > 0 && (
        <FacetCard depth={1} className="p-6 backdrop-blur-xl border border-black/8 dark:border-white/10">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-stone-950 dark:text-white">
                Synced Custom Fields
              </h3>
            </div>
            <span className="text-[10px] font-mono text-stone-400">auto-synced</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(forum.customFields).map(([key, value]) => {
              const label = key.replace("ixstats_", "").replace(/_/g, " ");
              return (
                <div
                  key={key}
                  className="rounded-2xl border border-black/5 dark:border-white/5 bg-stone-50/50 dark:bg-white/[0.02] p-3 text-xs"
                >
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400">
                    {label}
                  </div>
                  <div className="mt-1 font-bold text-stone-900 dark:text-white truncate">
                    {value}
                  </div>
                </div>
              );
            })}
          </div>
        </FacetCard>
      )}
    </div>
  );
}
