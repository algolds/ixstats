"use client";

import React, { use, useCallback, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Skeleton } from "~/components/ui/skeleton";
import { DashboardColumn } from "~/components/dashboard/DashboardColumn";
import { WarningTriangle as AlertTriangle } from "iconoir-react";
import { useUser } from "~/context/auth-context";
import { MidRibbonPassportDocument } from "~/components/passport/MidRibbonPassportDocument";
import { DEFAULT_PASSPORT_TAB, parsePassportTab } from "~/components/passport/passport-tabs";
import type { PassportTabType } from "~/components/passport/types";
import { EmptyState } from "~/components/ui/empty-state";
import { Card } from "~/components/ui/card";

export default function UnifiedIxnayIdProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = use(params);
  const cleanUsername = decodeURIComponent(rawUsername).replace(/^@/, "");

  return <IxnayIdPassportCanvas cleanUsername={cleanUsername} />;
}

function IxnayIdPassportCanvas({ cleanUsername }: { cleanUsername: string }) {
  const { user: currentClerkUser } = useUser();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PassportTabType>(
    () => parsePassportTab(searchParams.get("tab")) ?? DEFAULT_PASSPORT_TAB
  );

  // Sync tab from URL if present
  useEffect(() => {
    const tab = parsePassportTab(searchParams.get("tab"));
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const { data, isLoading, error } = api.ixnayid.getPassport.useQuery(
    { handle: cleanUsername },
    { enabled: Boolean(cleanUsername) }
  );

  const isOwner = Boolean(data?.account.isOwner);

  // Display name and avatar come from Clerk
  const displayName =
    (isOwner && currentClerkUser ? currentClerkUser.fullName || currentClerkUser.username : null) ||
    data?.account.clerkDisplayName ||
    data?.account.clerkUsername ||
    cleanUsername;

  const avatarUrl =
    (isOwner && currentClerkUser ? currentClerkUser.imageUrl : null) ||
    data?.account.clerkImageUrl ||
    null;

  usePageTitle({
    title: `${displayName} (@${cleanUsername}) · Identity passport`,
  });

  const handleSelectTab = useCallback((tab: PassportTabType) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === DEFAULT_PASSPORT_TAB) {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  if (isLoading) {
    return (
      <DashboardColumn>
        <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6">
          <div className="flex items-start gap-6">
            <Skeleton className="rounded-sheet h-24 w-24 shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="rounded-row h-8 w-64" />
              <Skeleton className="rounded-control h-4 w-40" />
              <Skeleton className="rounded-card h-16 w-full max-w-xl" />
            </div>
          </div>
          <Skeleton className="rounded-card h-10 w-80" />
          <div className="space-y-4">
            <Skeleton className="rounded-sheet h-32 w-full" />
            <Skeleton className="rounded-sheet h-48 w-full" />
          </div>
        </div>
      </DashboardColumn>
    );
  }

  if (error || !data) {
    return (
      <DashboardColumn>
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
          <Card>
            <EmptyState
              icon={<AlertTriangle className="text-caution" />}
              title="Identity not found"
              message={`No public passport or registered identity exists for @${cleanUsername}.`}
            />
          </Card>
        </div>
      </DashboardColumn>
    );
  }

  return (
    <DashboardColumn>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        <MidRibbonPassportDocument
          cleanUsername={cleanUsername}
          displayName={displayName}
          avatarUrl={avatarUrl}
          data={data}
          isOwner={isOwner}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
        />
      </div>
    </DashboardColumn>
  );
}
