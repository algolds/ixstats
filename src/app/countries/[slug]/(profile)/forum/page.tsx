"use client";

import React from "react";
import { useCountryData } from "~/components/mycountry/primitives";
import { useCountryProfile } from "../../_context/CountryProfileContext";
import { ForumTab } from "../../_components/tabs/ForumTab";
import { Skeleton } from "~/components/ui/skeleton";

export default function CountryForumPage() {
  const { country } = useCountryData();
  const { unifiedProfile, isOwnCountry, isLoading } = useCountryProfile();

  if (isLoading && !unifiedProfile) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-20 rounded-2xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!unifiedProfile?.forum) {
    return (
      <ForumTab
        forum={{
          linked: false,
          userId: null,
          username: country?.name ?? null,
          userTitle: null,
          avatarUrl: null,
          isStaff: false,
          messageCount: 0,
          reactionScore: 0,
          trophyPoints: 0,
          joinedDate: null,
          location: null,
          aboutHtml: null,
          customFields: null,
        }}
        username={country?.name}
        isOwnCountry={isOwnCountry}
      />
    );
  }

  return (
    <ForumTab
      forum={unifiedProfile.forum}
      username={
        unifiedProfile.forum.username ||
        unifiedProfile.account.roleName ||
        unifiedProfile.country?.name ||
        country?.name
      }
      isOwnCountry={isOwnCountry}
    />
  );
}

