"use client";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Link as Link2,
  LinkSlash as Unlink,
  ChatBubble as MessageSquare,
  OpenBook as BookOpen,
  SystemRestart as Loader2,
  Check,
  OpenNewWindow as ExternalLink,
  Discord,
  User as UserIcon,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { WikiAccountVerifyRow } from "~/components/settings/WikiAccountVerifyRow";
import { ForumAccountVerify } from "~/components/settings/ForumAccountVerify";

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
    <div className="rounded-row border-separator bg-surface-secondary relative flex items-center gap-4 border p-4">
      <div className={`rounded-row flex h-12 w-12 shrink-0 items-center justify-center ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-headline text-label">{name}</span>
          {linked && (
            <Badge variant="success">
              <Check aria-hidden />
              Verified
            </Badge>
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
            Not connected
          </p>
        )}
        {extra}
      </div>
      <div className="shrink-0">
        {linked ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={onUnlink}
            disabled={isUnlinking}
          >
            {isUnlinking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unlink className="h-3.5 w-3.5" />
            )}
            Unlink
          </Button>
        ) : (
          <Button onClick={onLink} disabled={isLinking} variant="secondary" size="sm">
            {isLinking ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            Connect
          </Button>
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
  const [showForumInput, setShowForumInput] = useState(false);

  // Mutations
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
      className="border-separator bg-surface rounded-card overflow-hidden border"
    >
      <div className="relative p-6">
        <div className="relative z-10 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-title-3 text-label">IxnayID©</h2>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {status?.passportHandle && (
              <Button asChild size="sm">
                <Link href={`/@${status.passportHandle}`}>
                  <UserIcon aria-hidden />
                  <span>View passport</span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Forum */}
          <ServiceRow
            name="Community forum"
            icon={<MessageSquare className="h-6 w-6 text-orange-500" />}
            color="bg-orange-100 dark:bg-orange-900/30"
            linked={status?.forum.linked ?? false}
            username={status?.forum.username ?? null}
            lastSync={status?.forum.lastSync ?? null}
            onLink={() => setShowForumInput(true)}
            onUnlink={() => unlinkForum.mutate()}
            isLinking={false}
            isUnlinking={unlinkForum.isPending}
          />

          {/* Forum verification: a code on the forum profile proves the account (WK-1) */}
          {showForumInput && !status?.forum.linked && (
            <div className="ml-14 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-600 dark:bg-gray-700">
              <ForumAccountVerify
                onLinked={() => setShowForumInput(false)}
                onCancel={() => setShowForumInput(false)}
              />
            </div>
          )}

          {/* Wiki (verified by user-page token) */}
          <div className="rounded-row border-separator bg-surface-secondary flex items-start gap-4 border p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-100 shadow-inner dark:bg-blue-900/30">
              <BookOpen className="h-6 w-6 text-blue-500" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-headline text-label">Wiki</span>
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
            name="Discord"
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
