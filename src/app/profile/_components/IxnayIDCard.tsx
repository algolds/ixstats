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
  borderColor: string;
  bgColor: string;
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
  borderColor,
  bgColor,
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
    <div className={`flex items-center gap-4 rounded-lg border p-4 ${borderColor} ${bgColor}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{name}</span>
          {linked && (
            <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <Check className="h-2.5 w-2.5" />
              Connected
            </span>
          )}
        </div>
        {linked && username ? (
          <p className="mt-0.5 truncate text-xs text-gray-600 dark:text-gray-400">
            {username}
            {lastSync && (
              <span className="ml-2 text-gray-400 dark:text-gray-500">
                · synced {new Date(lastSync).toLocaleDateString()}
              </span>
            )}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Not connected</p>
        )}
        {extra}
      </div>
      <div className="shrink-0">
        {linked ? (
          <button
            onClick={onUnlink}
            disabled={isUnlinking}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {isUnlinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
            Unlink
          </button>
        ) : (
          <button
            onClick={onLink}
            disabled={isLinking}
            className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
          >
            {isLinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Link
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
    <div id="ixnayid-card" className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-1 flex items-center gap-2">
        <Link2 className="h-5 w-5 text-indigo-500" />
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">IxnayID©</h2>
      </div>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Link your accounts across all Ixnay services
      </p>

      <div className="space-y-3">
        {/* Forum */}
        <ServiceRow
          name="Forum"
          icon={<MessageSquare className="h-5 w-5 text-orange-500" />}
          color="bg-orange-100 dark:bg-orange-900/30"
          borderColor="border-gray-200 dark:border-gray-700"
          bgColor="bg-gray-50 dark:bg-gray-800/50"
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
          name="Wiki"
          icon={<BookOpen className="h-5 w-5 text-blue-500" />}
          color="bg-blue-100 dark:bg-blue-900/30"
          borderColor="border-gray-200 dark:border-gray-700"
          bgColor="bg-gray-50 dark:bg-gray-800/50"
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
          name="Discord"
          icon={<FaDiscord className="h-5 w-5 text-[#5865F2]" />}
          color="bg-indigo-100 dark:bg-indigo-900/30"
          borderColor="border-gray-200 dark:border-gray-700"
          bgColor="bg-gray-50 dark:bg-gray-800/50"
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
  );
}
