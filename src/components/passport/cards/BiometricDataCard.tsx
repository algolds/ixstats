"use client";

import React from "react";
import { MidRibbonPassportDocument } from "../MidRibbonPassportDocument";
import type { PassportTabType, UnifiedProfilePayload, RealmItem } from "../types";

export interface BiometricDataCardProps {
  cleanUsername: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  data: UnifiedProfilePayload;
  realms: RealmItem[];
  isOwner: boolean;
  activeTab?: PassportTabType;
  onSelectTab?: (tab: PassportTabType) => void;
}

export function BiometricDataCard({
  cleanUsername,
  displayName,
  avatarUrl,
  bio,
  data,
  realms,
  isOwner,
  activeTab = "realms",
  onSelectTab = () => {},
}: BiometricDataCardProps) {
  return (
    <MidRibbonPassportDocument
      cleanUsername={cleanUsername}
      displayName={displayName}
      avatarUrl={avatarUrl}
      bio={bio}
      data={data}
      realms={realms}
      isOwner={isOwner}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
    />
  );
}
