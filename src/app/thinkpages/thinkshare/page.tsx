"use client";

import React from "react";
import { useUser } from "~/context/auth-context";
import { ArrowLeft, Send } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import dynamic from "next/dynamic";
import { api } from "~/trpc/react";

// Dynamically import to prevent tRPC queries from running until needed
const ThinkshareMessages = dynamic(
  () =>
    import("~/components/thinkshare/ThinkshareMessages").then((mod) => ({
      default: mod.ThinkshareMessages,
    })),
  {
    loading: () => (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
            <h3 className="mb-2 text-lg font-semibold">Loading ThinkShare...</h3>
            <p className="text-muted-foreground">Please wait while we set up your conversations</p>
          </CardContent>
        </Card>
      </div>
    ),
    ssr: false,
  }
);

export default function ThinkSharePage() {
  const { user } = useUser();

  // Get user profile
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <Send className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
          <h2 className="mb-2 text-2xl font-bold">Sign in to access ThinkShare</h2>
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
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to ThinkPages
          </Button>
        </Link>
        <h1 className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-2xl font-bold text-transparent">
          ThinkShare
        </h1>
        <div className="w-32" /> {/* Spacer for centering */}
      </div>

      <ThinkshareMessages userId={user.id} />
    </div>
  );
}
