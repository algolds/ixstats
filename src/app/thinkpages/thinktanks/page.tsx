"use client";

import React from "react";
import { useUser } from "@clerk/nextjs";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import dynamic from 'next/dynamic';

// Dynamically import to prevent tRPC queries from running until needed
const ThinktankGroups = dynamic(
  () => import("~/components/thinkpages/ThinktankGroups").then((mod) => ({ default: mod.ThinktankGroups })),
  {
    loading: () => (
      <div className="space-y-6">
        <Card className="glass-hierarchy-parent">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <h3 className="text-lg font-semibold mb-2">Loading ThinkTanks...</h3>
            <p className="text-muted-foreground">Please wait while we set up your groups</p>
          </CardContent>
        </Card>
      </div>
    ),
    ssr: false
  }
);

export default function ThinkTanksPage() {
  const { user } = useUser();

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Sign in to access ThinkTanks</h2>
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
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to ThinkPages
          </Button>
        </Link>
        <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          ThinkTanks
        </h1>
        <div className="w-32" /> {/* Spacer for centering */}
      </div>

      <ThinktankGroups userId={user.id} />
    </div>
  );
}
