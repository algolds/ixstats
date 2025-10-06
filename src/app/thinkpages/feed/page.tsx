"use client";

import React from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Globe, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { ThinkpagesSocialPlatform } from "~/components/thinkpages/ThinkpagesSocialPlatform";
import { api } from "~/trpc/react";

export default function ThinkPagesFeedPage() {
  const { user } = useUser();

  // Get user profile and country data
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  const { data: countryData, isLoading } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <Globe className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Sign in to access ThinkPages</h2>
          <p className="text-muted-foreground">Connect with minds worldwide</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/thinkpages">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to ThinkPages
          </Button>
        </Link>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          ThinkPages Feed
        </h1>
        <div className="w-32" /> {/* Spacer for centering */}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
        </div>
      ) : countryData && userProfile ? (
        <ThinkpagesSocialPlatform
          countryId={countryData.id}
          countryName={countryData.name}
          isOwner={userProfile.countryId === countryData.id}
        />
      ) : (
        <div className="text-center p-8">
          <p className="text-muted-foreground">Could not load country feed. You may not be associated with a country.</p>
        </div>
      )}
    </div>
  );
}