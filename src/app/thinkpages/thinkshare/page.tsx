"use client";

import React from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import dynamic from 'next/dynamic';
import { api } from "~/trpc/react";

// Dynamically import to prevent tRPC queries from running until needed
const ThinkshareMessages = dynamic(
  () => import("~/components/thinkshare/ThinkshareMessages").then((mod) => ({ default: mod.ThinkshareMessages })),
  {
    loading: () => (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Loading ThinkShare...</h3>
            <p className="text-muted-foreground">Please wait while we set up your conversations</p>
          </CardContent>
        </Card>
      </div>
    ),
    ssr: false
  }
);

export default function ThinkSharePage() {
  const { user } = useUser();

  // Get user profile
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <Send className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Sign in to access ThinkShare</h2>
          <p className="text-muted-foreground">Private messaging for minds worldwide</p>
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
        <h1 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
          ThinkShare
        </h1>
        <div className="w-32" /> {/* Spacer for centering */}
      </div>

      <ThinkshareMessages userId={user.id} />
    </div>
  );
}
