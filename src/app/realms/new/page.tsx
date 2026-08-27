"use client";

import { CreateOrganization } from "@clerk/nextjs";
import { Globe } from "iconoir-react";
import { facetClerkAppearance } from "~/lib/clerk/theme";
import { usePageTitle } from "~/hooks/usePageTitle";

export default function NewRealmPage() {
  usePageTitle({
    title: "Found New Realm · World Studio",
  });

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col items-center justify-center p-4 md:p-8">
      <div className="mb-6 flex flex-col items-center gap-2 text-center">
        <div className="border-border bg-accent text-foreground flex h-12 w-12 items-center justify-center rounded-2xl border shadow-md">
          <Globe className="h-6 w-6" />
        </div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Found a New Realm</h1>
        <p className="text-muted-foreground max-w-md text-xs">
          Create an independent world for your community, worldbuilding campaign, or group.
        </p>
      </div>

      <div className="flex w-full justify-center">
        <CreateOrganization
          routing="hash"
          afterCreateOrganizationUrl="/r/:slug"
          appearance={facetClerkAppearance}
        />
      </div>
    </div>
  );
}
