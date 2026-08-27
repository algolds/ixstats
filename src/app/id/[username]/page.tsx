"use client";

import React, { use, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Skeleton } from "~/components/ui/skeleton";
import { DashboardSidebarLayout } from "~/components/dashboard/sidebar/DashboardSidebarLayout";
import { WarningTriangle as AlertTriangle } from "iconoir-react";
import { useUser } from "~/context/auth-context";
import { MidRibbonPassportDocument } from "~/components/passport/MidRibbonPassportDocument";
import type { PassportTabType } from "~/components/passport/types";

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
  const rawTabParam = searchParams.get("tab");
  const initialTab: PassportTabType =
    rawTabParam === "work" || rawTabParam === "wiki" || rawTabParam === "lore"
      ? "lore"
      : (rawTabParam as PassportTabType) || "realms";
  const [activeTab, setActiveTab] = useState<PassportTabType>(initialTab);

  // Sync tab from URL if present
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      if (tabParam === "work" || tabParam === "wiki" || tabParam === "lore") {
        setActiveTab("lore");
      } else if (tabParam === "realms" || tabParam === "history" || tabParam === "vault") {
        setActiveTab(tabParam as PassportTabType);
      }
    }
  }, [searchParams]);

  const { data, isLoading, error } = api.ixnayid.getUnifiedProfile.useQuery(
    { identifier: cleanUsername },
    { enabled: Boolean(cleanUsername) }
  );

  const isOwner = Boolean(data?.account?.isOwner);

  // Authoritatively sync Display Name & Avatar exclusively from Clerk
  const displayName =
    (isOwner && currentClerkUser ? currentClerkUser.fullName || currentClerkUser.username : null) ||
    data?.account?.clerkDisplayName ||
    data?.account?.clerkUsername ||
    cleanUsername;

  const bio = data?.thinkpages?.bio || data?.forum?.aboutHtml || null;

  const avatarUrl =
    (isOwner && currentClerkUser ? currentClerkUser.imageUrl : null) ||
    data?.account?.clerkImageUrl ||
    null;

  const realms = data?.realms ?? [];

  usePageTitle({
    title: `${displayName} (@${cleanUsername}) · Identity Passport`,
  });

  const handleSelectTab = (tab: PassportTabType) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "realms") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  if (isLoading) {
    return (
      <DashboardSidebarLayout disableCollapse={true}>
        <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6">
          <div className="flex items-start gap-6">
            <Skeleton className="h-24 w-24 shrink-0 rounded-3xl" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-8 w-64 rounded-xl" />
              <Skeleton className="h-4 w-40 rounded-lg" />
              <Skeleton className="h-16 w-full max-w-xl rounded-2xl" />
            </div>
          </div>
          <Skeleton className="h-10 w-80 rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-3xl" />
            <Skeleton className="h-48 w-full rounded-3xl" />
          </div>
        </div>
      </DashboardSidebarLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardSidebarLayout disableCollapse={true}>
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
          <div className="space-y-4 rounded-3xl border border-black/8 bg-black/[0.015] p-8 text-center dark:border-white/10 dark:bg-white/[0.02]">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <h2 className="text-foreground text-xl font-bold">Identity Not Found</h2>
            <p className="text-muted-foreground mx-auto max-w-md text-sm">
              Could not resolve a public passport or registered identity for @{cleanUsername}.
            </p>
          </div>
        </div>
      </DashboardSidebarLayout>
    );
  }

  return (
    <DashboardSidebarLayout disableCollapse={true}>
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
        {/* Mid-Ribbon Integrated Polycarbonate Passport Document */}
        <MidRibbonPassportDocument
          cleanUsername={cleanUsername}
          displayName={displayName}
          avatarUrl={avatarUrl}
          bio={bio}
          data={data}
          realms={realms}
          isOwner={isOwner}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
        />
      </div>
    </DashboardSidebarLayout>
  );
}
