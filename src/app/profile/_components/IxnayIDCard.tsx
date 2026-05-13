"use client";

import { useState } from "react";
import {
  Link2,
  Unlink,
  MessageSquare,
  BookOpen,
  Loader2,
  Check,
  Search,
  ExternalLink,
} from "lucide-react";
import { FaDiscord } from "react-icons/fa";
import { api } from "~/trpc/react";

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
    <div className="glass-hierarchy-child group relative flex items-center gap-4 rounded-2xl border border-slate-200 bg-white/30 p-4 transition-all duration-300 hover:bg-white/50 dark:border-slate-700/50 dark:bg-slate-800/20 dark:hover:bg-slate-800/40">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-inner ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-900 dark:text-white">{name}</span>
          {linked && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Check className="h-2.5 w-2.5" />
              Verified
            </span>
          )}
        </div>
        {linked && username ? (
          <p className="mt-0.5 truncate text-xs font-medium text-slate-600 dark:text-slate-400">
            {username}
            {lastSync && (
              <span className="ml-2 text-[10px] text-slate-400 dark:text-slate-500">
                • active {new Date(lastSync).toLocaleDateString()}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-0.5 text-xs font-medium text-slate-400 dark:text-slate-500">Awaiting connection...</p>
        )}
        {extra}
      </div>
      <div className="shrink-0">
        {linked ? (
          <button
            onClick={onUnlink}
            disabled={isUnlinking}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-red-600 transition-all hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {isUnlinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
            Sever
          </button>
        ) : (
          <button
            onClick={onLink}
            disabled={isLinking}
            className="glass-interactive flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-700"
          >
            {isLinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

export function IxnayIDCard() {
  const utils = api.useUtils();
  const { data: status, isLoading } = api.ixnayid.getStatus.useQuery();

  // Linking state
  const [forumInput, setForumInput] = useState("");
  const [wikiInput, setWikiInput] = useState("");
  const [showForumInput, setShowForumInput] = useState(false);
  const [showWikiInput, setShowWikiInput] = useState(false);

  // Lookup previews
  const [forumLookup, setForumLookup] = useState<string | null>(null);
  const [wikiLookup, setWikiLookup] = useState<{ username: string; editCount: number } | null>(null);

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

  const linkWiki = api.ixnayid.linkWiki.useMutation({
    onSuccess: () => {
      utils.ixnayid.getStatus.invalidate();
      setShowWikiInput(false);
      setWikiInput("");
      setWikiLookup(null);
    },
  });

  const unlinkWiki = api.ixnayid.unlinkWiki.useMutation({
    onSuccess: () => utils.ixnayid.getStatus.invalidate(),
  });

  const linkDiscord = api.ixnayid.linkDiscord.useMutation({
    onSuccess: () => utils.ixnayid.getStatus.invalidate(),
  });

  const unlinkDiscord = api.ixnayid.unlinkDiscord.useMutation({
    onSuccess: () => utils.ixnayid.getStatus.invalidate(),
  });

  // Lookup queries (manual trigger via refetch)
  const forumLookupQuery = api.ixnayid.lookupForumUser.useQuery(
    { username: forumInput },
    { enabled: false }
  );

  const wikiLookupQuery = api.ixnayid.lookupWikiUser.useQuery(
    { username: wikiInput },
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

  const handleWikiLookup = async () => {
    if (!wikiInput.trim()) return;
    const result = await wikiLookupQuery.refetch();
    if (result.data) {
      setWikiLookup({ username: result.data.username, editCount: result.data.editCount });
    } else {
      setWikiLookup(null);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">IxnayID</h2>
        </div>
        <div className="mt-4 flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div id="ixnayid-card" className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <Link2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">IxnayID©</h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Universal Account Manager</p>
            </div>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Secure Layer Active
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
              <input
                type="text"
                value={forumInput}
                onChange={(e) => { setForumInput(e.target.value); setForumLookup(null); }}
                placeholder="Forum username..."
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                onKeyDown={(e) => e.key === "Enter" && handleForumLookup()}
              />
              <button
                onClick={handleForumLookup}
                disabled={!forumInput.trim() || forumLookupQuery.isFetching}
                className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
              >
                {forumLookupQuery.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
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
              <p className="text-xs text-red-500">User not found. Check the username and try again.</p>
            )}
            {linkForum.error && (
              <p className="text-xs text-red-500">{linkForum.error.message}</p>
            )}
            <button
              onClick={() => { setShowForumInput(false); setForumInput(""); setForumLookup(null); }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Wiki */}
        <ServiceRow
          name="Global Wiki"
          icon={<BookOpen className="h-6 w-6 text-blue-500" />}
          color="bg-blue-100 dark:bg-blue-900/30"
          linked={status?.wiki.linked ?? false}
          username={status?.wiki.username ?? null}
          lastSync={status?.wiki.lastSync ?? null}
          onLink={() => setShowWikiInput(true)}
          onUnlink={() => unlinkWiki.mutate()}
          isLinking={linkWiki.isPending}
          isUnlinking={unlinkWiki.isPending}
        />

        {/* Wiki input */}
        {showWikiInput && !status?.wiki.linked && (
          <div className="ml-14 space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-700">
            <div className="flex gap-2">
              <input
                type="text"
                value={wikiInput}
                onChange={(e) => { setWikiInput(e.target.value); setWikiLookup(null); }}
                placeholder="Wiki username..."
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                onKeyDown={(e) => e.key === "Enter" && handleWikiLookup()}
              />
              <button
                onClick={handleWikiLookup}
                disabled={!wikiInput.trim() || wikiLookupQuery.isFetching}
                className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
              >
                {wikiLookupQuery.isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                Look up
              </button>
            </div>
            {wikiLookup && (
              <div className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2 dark:bg-green-900/20">
                <span className="text-xs text-green-700 dark:text-green-400">
                  Found: <strong>{wikiLookup.username}</strong> ({wikiLookup.editCount.toLocaleString()} edits)
                </span>
                <button
                  onClick={() => linkWiki.mutate({ wikiUsername: wikiLookup.username })}
                  disabled={linkWiki.isPending}
                  className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                >
                  {linkWiki.isPending ? "Linking..." : "Confirm Link"}
                </button>
              </div>
            )}
            {wikiLookupQuery.isError && (
              <p className="text-xs text-red-500">User not found. Check the username and try again.</p>
            )}
            {linkWiki.error && (
              <p className="text-xs text-red-500">{linkWiki.error.message}</p>
            )}
            <button
              onClick={() => { setShowWikiInput(false); setWikiInput(""); setWikiLookup(null); }}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Discord */}
        <ServiceRow
          name="Discord Global"
          icon={<FaDiscord className="h-6 w-6 text-[#5865F2]" />}
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
