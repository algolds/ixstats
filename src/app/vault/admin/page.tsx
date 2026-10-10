"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, ArrowLeft } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useIsAdmin } from "~/hooks/usePermissions";

export default function VaultAdminPage() {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const isAdmin = useIsAdmin();

  if (!isSignedIn) {
    router.push("/sign-in");
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="mx-auto flex max-w-md flex-col gap-6 py-6">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <Shield className="text-label-secondary h-10 w-10" />
            <h2 className="text-title-3 font-semibold">Admin access required</h2>
            <p className="text-label-secondary text-body">
              You need admin permissions to access the vault admin panel.
            </p>
            <Link href={"/vault"}>
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
      <Card className="mx-auto flex max-w-md flex-col gap-6 py-6">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <Shield className="text-yellow h-10 w-10" />
          <h2 className="text-title-3 font-semibold">Vault admin</h2>
          <p className="text-label-secondary text-body">
            The vault admin panel has moved to the admin section.
          </p>
          <Link href={"/admin/vault"}>
            <Button size="sm">
              <Shield className="mr-1 h-4 w-4" /> Open Vault Admin
            </Button>
          </Link>
          <Link href={"/vault"}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to Vault
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
