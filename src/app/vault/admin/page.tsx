"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft } from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useIsAdmin } from "~/hooks/usePermissions";

export default function VaultAdminPage() {
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
            <Shield className="h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Admin Access Required</h2>
            <p className="text-sm text-muted-foreground">
              You need admin permissions to access the vault admin panel.
            </p>
            <Link href={withBasePath("/vault")}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" /> Back to Vault
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="mx-auto max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <Shield className="h-10 w-10 text-amber-500" />
          <h2 className="text-lg font-semibold">Vault Admin</h2>
          <p className="text-sm text-muted-foreground">
            The vault admin panel has moved to the admin section.
          </p>
          <Link href={withBasePath("/admin/vault")}>
            <Button size="sm">
              <Shield className="mr-1 h-4 w-4" /> Open Vault Admin
            </Button>
          </Link>
          <Link href={withBasePath("/vault")}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Vault
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
