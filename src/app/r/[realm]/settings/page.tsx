"use client";

import { use } from "react";
import Link from "next/link";
import { OrganizationProfile, useOrganization, useOrganizationList } from "@clerk/nextjs";
import { Globe, NavArrowLeft } from "iconoir-react";
import { facetClerkAppearance } from "~/lib/clerk/theme";
import { usePageTitle } from "~/hooks/usePageTitle";

export default function RealmSettingsPage({
  params,
}: {
  params: Promise<{ realm: string }>;
}) {
  const { realm } = use(params);

  const { organization: currentOrg } = useOrganization();
  const { userMemberships } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  const matchingOrg =
    currentOrg?.slug === realm || currentOrg?.id === realm
      ? currentOrg
      : userMemberships?.data?.find(
          (m) => m.organization.slug === realm || m.organization.id === realm
        )?.organization;

  const realmLogo = matchingOrg?.imageUrl;

  usePageTitle({
    title: `Realm Settings · ${realm}`,
  });

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col items-center justify-center p-4 md:p-8">
      <div className="mb-6 flex w-full max-w-4xl items-center justify-between">
        <Link
          href={`/r/${realm}`}
          className="facet-interactive flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground active:scale-[0.98]"
        >
          <NavArrowLeft className="h-4 w-4" />
          <span>Back to Realm</span>
        </Link>
        <div className="flex items-center gap-1.5 rounded-md border border-border bg-accent px-2 py-0.5 text-[10px] font-bold text-foreground">
          {realmLogo ? (
            <img
              src={realmLogo}
              alt={realm}
              className="h-3.5 w-3.5 rounded object-cover"
            />
          ) : (
            <Globe className="h-3 w-3" />
          )}
          <span>Realm: {realm}</span>
        </div>
      </div>

      <div className="w-full flex justify-center">
        <OrganizationProfile
          routing="hash"
          afterLeaveOrganizationUrl="/dashboard"
          appearance={facetClerkAppearance}
        />
      </div>
    </div>
  );
}
