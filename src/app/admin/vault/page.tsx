"use client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft } from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useIsAdmin } from "~/hooks/usePermissions";
import { useAuth } from "@clerk/nextjs";
import { VaultAdmin } from "~/app/admin/cards/VaultAdmin";
import { usePageTitle } from "~/hooks/usePageTitle";

export default function AdminVaultPage() {
  usePageTitle({ title: "Admin - Vault" });
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const isAdmin = useIsAdmin();

  if (!isSignedIn) {
    router.push(withBasePath("/sign-in"));
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Shield className="text-muted-foreground h-10 w-10" />
            <h2 className="text-lg font-semibold">Admin Access Required</h2>
            <p className="text-muted-foreground text-sm">
              You need admin permissions to access this page.
            </p>
            <Link href={withBasePath("/")}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-6 py-8">
      <VaultAdmin />
    </div>
  );
}
