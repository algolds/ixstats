"use client";

import React from "react";
import { useUser } from "~/context/auth-context";
import { ArrowLeft, Globe, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { ThinkpagesSocialPlatform } from "~/components/thinkpages/ThinkpagesSocialPlatform";
import { api } from "~/trpc/react";

export default function ThinkPagesFeedPage() {
  const { user } = useUser();

  // Get user profile and country data (optional for authenticated users)
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );

  // For anonymous users or users without a country, show global feed with default values
  const displayCountryId = countryData?.id || 'global';
  const displayCountryName = countryData?.name || 'Global Community';
  const isOwner = userProfile?.countryId === countryData?.id;

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
          ThinkPages Global Feed
        </h1>
        <div className="w-32" /> {/* Spacer for centering */}
      </div>

      {/* Show info banner for anonymous users */}
      {!user && (
        <Card className="glass-hierarchy-parent mb-6">
          <CardContent className="p-6 flex items-start gap-4">
            <Globe className="h-8 w-8 text-blue-500 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">Viewing ThinkPages in Read-Only Mode</h3>
              <p className="text-muted-foreground mb-3">
                You're browsing the global ThinkPages feed. To create posts, react to content, and join discussions, please sign in or create an account.
              </p>
              <Link href="/setup">
                <Button size="sm">
                  Sign In / Sign Up
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <ThinkpagesSocialPlatform
        countryId={displayCountryId}
        countryName={displayCountryName}
        isOwner={isOwner}
      />
    </div>
  );
}
