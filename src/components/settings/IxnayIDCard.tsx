"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Link as Link2,
  LinkSlash as Unlink,
  ChatBubble as MessageSquare,
  OpenBook as BookOpen,
  SystemRestart as Loader2,
  Check,
  Search,
  OpenNewWindow as ExternalLink,
  Discord,
  User as UserIcon,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Input } from "~/components/ui/input";
import { WikiAccountVerifyRow } from "~/components/settings/WikiAccountVerifyRow";

interface ServiceRowProps {
  name: string;
  icon: React.ReactNode;
  color: string;
  linked: boolean;
  username: string | null;
  lastSync: Date | string | null;
  extra?: React.ReactNode;
  onLink: () => void;
  onUnlink: () => void;
  isLinking: boolean;
  isUnlinking: boolean;
}

function ServiceRow({
  name,
  icon,
  color,
  linked,
  username,
  lastSync,
  extra,
  onLink,
  onUnlink,
  isLinking,
  isUnlinking,
}: ServiceRowProps) {
  return (
    <div className="facet-hierarchy-child group relative flex items-center gap-4 rounded-2xl border border-slate-200 bg-white/30 p-4 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 hover:bg-white/50 dark:border-slate-700/50 dark:bg-slate-800/20 dark:hover:bg-slate-800/40">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner ${color}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900 dark:text-white">{name}</span>
          {linked && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Check className="h-2.5 w-2.5" />
              Verified
            </span>
          )}
        </div>
        {linked && username ? (
          <p className="mt-0.5 truncate text-xs font-medium text-slate-600 dark:text-slate-400">
            {username}
            {lastSync && (
              <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                • active {new Date(lastSync).toLocaleDateString()}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">
            Awaiting connection...
          </p>
        )}
        {extra}
      </div>
      <div className="shrink-0">
        {linked ? (
          <button
            onClick={onUnlink}
            disabled={isUnlinking}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-red-600 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {isUnlinking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unlink className="h-3.5 w-3.5" />
            )}
            Sever
          </button>
        ) : (
          <button
            onClick={onLink}
            disabled={isLinking}
            className="facet-interactive flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-indigo-700"
          >
            {isLinking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

interface IxnayIDCardProps {
  hasDiscordAccount?: boolean;
}

export function IxnayIDCard({ hasDiscordAccount }: IxnayIDCardProps) {
  const utils = api.useUtils();
  const { data: status, isLoading } = api.ixnayid.getStatus.useQuery();
  const wikiLinks = api.ixnayid.listWikiLinks.useQuery();

  // Linking state
  const [forumInput, setForumInput] = useState("");
  const [showForumInput, setShowForumInput] = useState(false);

  // Lookup previews
  const [forumLookup, setForumLookup] = useState<string | null>(null);

  // Mutations
  const linkForum = api.ixnayid.linkForum.useMutation({
    onSuccess: () => {
      utils.ixnayid.getStatus.invalidate();
      setShowForumInput(false);
      setForumInput("");
      setForumLookup(null);
    },
  });

  const unlinkForum = api.ixnayid.unlinkForum.useMutation({
    onSuccess: () => utils.ixnayid.getStatus.invalidate(),
  });

  const linkDiscord = api.ixnayid.linkDiscord.useMutation({
    onSuccess: () => utils.ixnayid.getStatus.invalidate(),
  });

  const unlinkDiscord = api.ixnayid.unlinkDiscord.useMutation({
    onSuccess: () => utils.ixnayid.getStatus.invalidate(),
  });

  // Auto-link Discord if user signed in via Discord but IxnayID is not yet linked
  const autoLinked = useRef(false);
  useEffect(() => {
    if (
      hasDiscordAccount &&
      status &&
      !status.discord.linked &&
      !linkDiscord.isPending &&
      !autoLinked.current
    ) {
      autoLinked.current = true;
      linkDiscord.mutate();
    }
  }, [hasDiscordAccount, status, linkDiscord]);

  // Lookup queries (manual trigger via refetch)
  const forumLookupQuery = api.ixnayid.lookupForumUser.useQuery(
    { username: forumInput },
    { enabled: false }
  );

  const handleForumLookup = async () => {
    if (!forumInput.trim()) return;
    const result = await forumLookupQuery.refetch();
    if (result.data) {
      setForumLookup(result.data.username);
    } else {
      setForumLookup(null);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">IxnayID</h2>
        </div>
        <div className="mt-4 flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div
      id="ixnayid-card"
      className="facet-surface facet-refraction overflow-hidden rounded-3xl p-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-500 hover:shadow-2xl"
    >
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
        <TextureOverlay texture="noise" opacity={0.04} />
        <div className="relative z-10 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">IxnayID©</h2>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {status?.passportHandle && (
              <Link
                href={`/@${status.passportHandle}`}
                className="facet-interactive flex cursor-pointer items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-[color,background-color,border-color,box-shadow,opacity,transform] hover:bg-blue-700 active:scale-95"
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span>View Passport</span>
              </Link>
            )}
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold tracking-widest text-slate-500 uppercase dark:bg-slate-800 dark:text-slate-400">
              Secure Layer Active
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Forum */}
          <ServiceRow
            name="Community Forum"
            icon={<MessageSquare className="h-6 w-6 text-orange-500" />}
            color="bg-orange-100 dark:bg-orange-900/30"
            linked={status?.forum.linked ?? false}
            username={status?.forum.username ?? null}
            lastSync={status?.forum.lastSync ?? null}
            onLink={() => setShowForumInput(true)}
            onUnlink={() => unlinkForum.mutate()}
            isLinking={linkForum.isPending}
            isUnlinking={unlinkForum.isPending}
          />

          {/* Forum input */}
          {showForumInput && !status?.forum.linked && (
            <div className="ml-14 space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-700">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={forumInput}
                  onChange={(e) => {
                    setForumInput(e.target.value);
                    setForumLookup(null);
                  }}
                  placeholder="Forum username..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleForumLookup()}
                />
                <button
                  onClick={handleForumLookup}
                  disabled={!forumInput.trim() || forumLookupQuery.isFetching}
                  className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                >
                  {forumLookupQuery.isFetching ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Search className="h-3 w-3" />
                  )}
                  Look up
                </button>
              </div>
              {forumLookup && (
                <div className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2 dark:bg-green-900/20">
                  <span className="text-xs text-green-700 dark:text-green-400">
                    Found: <strong>{forumLookup}</strong>
                  </span>
                  <button
                    onClick={() => linkForum.mutate({ forumUsername: forumLookup })}
                    disabled={linkForum.isPending}
                    className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                  >
                    {linkForum.isPending ? "Linking..." : "Confirm Link"}
                  </button>
                </div>
              )}
              {forumLookupQuery.isError && (
                <p className="text-xs text-red-500">
                  User not found. Check the username and try again.
                </p>
              )}
              {linkForum.error && <p className="text-xs text-red-500">{linkForum.error.message}</p>}
              <button
                onClick={() => {
                  setShowForumInput(false);
                  setForumInput("");
                  setForumLookup(null);
                }}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Wiki (verified by user-page token) */}
          <div className="facet-hierarchy-child flex items-start gap-4 rounded-2xl border border-slate-200 bg-white/30 p-4 dark:border-slate-700/50 dark:bg-slate-800/20">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 shadow-inner dark:bg-blue-900/30">
              <BookOpen className="h-6 w-6 text-blue-500" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                Global Wiki
              </span>
              <div className="mt-2">
                <WikiAccountVerifyRow
                  source="ixwiki"
                  label="IxWiki"
                  link={wikiLinks.data?.find((l) => l.source === "ixwiki")}
                />
              </div>
            </div>
          </div>

          {/* Discord */}
          <ServiceRow
            name="Discord Global"
            icon={<Discord className="text-discord h-6 w-6" />}
            color="bg-indigo-100 dark:bg-indigo-900/30"
            linked={status?.discord.linked ?? false}
            username={status?.discord.username ?? null}
            lastSync={status?.discord.lastSync ?? null}
            onLink={() => linkDiscord.mutate()}
            onUnlink={() => unlinkDiscord.mutate()}
            isLinking={linkDiscord.isPending}
            isUnlinking={unlinkDiscord.isPending}
            extra={
              linkDiscord.error ? (
                <p className="mt-1 text-xs text-red-500">
                  {linkDiscord.error.message}
                  {linkDiscord.error.message.includes("account settings") && (
                    <a
                      href="https://accounts.ixwiki.com/user"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 inline-flex items-center gap-0.5 text-indigo-500 hover:underline"
                    >
                      Open account settings <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </p>
              ) : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
