// src/app/admin/lore-cards/batch-generator/page.tsx
// Standalone page wrapper for the batch lore card generator

"use client";

import { usePageTitle } from "~/hooks/usePageTitle";
import { SignInButton, useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { Button } from "~/components/ui/button";
import { ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { LoreCardBatchAdmin } from "~/app/admin/ns-sync/LoreCardBatchAdmin";

export default function BatchLoreCardGeneratorPage() {
  usePageTitle({ title: "Batch Lore Card Generator" });

  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <SignInButton mode="modal" />
      </div>
    );
  }

  const allowedRoles = new Set(["admin", "owner", "staff"]);
  const isSystemOwnerUser = !!user && isSystemOwner(user.id);
  const hasAdminRole =
    typeof user?.publicMetadata?.role === "string" && allowedRoles.has(user.publicMetadata.role);

  if (!isSystemOwnerUser && !hasAdminRole) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <h1 className="mb-4 text-2xl font-bold text-red-600 dark:text-red-400">Access Denied</h1>
          <p className="mb-6 text-gray-700 dark:text-gray-300">
            You do not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="glass-card-parent mb-6 rounded-xl border-2 border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-500/10 p-4 md:p-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-3">
                <Sparkles className="h-6 w-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-foreground text-2xl font-bold md:text-3xl">
                  Batch Lore Card Generator
                </h1>
                <p className="text-muted-foreground text-sm">
                  Generate multiple lore cards from wiki articles
                </p>
              </div>
            </div>
          </div>
        </div>

        <LoreCardBatchAdmin />
      </div>
    </div>
  );
}
