"use client";

import React from "react";
import { useUser } from "~/context/auth-context";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import dynamic from "next/dynamic";

// Dynamically import to prevent tRPC queries from running until needed
const ThinktankGroups = dynamic(
  () =>
    import("~/components/thinkpages/ThinktankGroups").then((mod) => ({
      default: mod.ThinktankGroups,
    })),
  {
    loading: () => (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2"></div>
            <h3 className="mb-2 text-lg font-semibold">Loading ThinkTanks...</h3>
            <p className="text-muted-foreground">Please wait while we set up your groups</p>
          </CardContent>
        </Card>
      </div>
    ),
    ssr: false,
  }
);

export default function ThinkTanksPage() {
  const { user } = useUser();

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <Users className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
          <h2 className="mb-2 text-2xl font-bold">Sign in to access ThinkTanks</h2>
          <p className="text-muted-foreground">Join policy discussion groups</p>
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
        <h1 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-2xl font-bold text-transparent">
          ThinkTanks
        </h1>
        <div className="w-32" /> {/* Spacer for centering */}
      </div>

      <ThinktankGroups userId={user.id} userAccounts={[]} />
    </div>
  );
}
