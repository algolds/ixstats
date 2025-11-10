"use client";

import { useState } from "react";
import { AuthenticationGuard } from "~/components/mycountry/primitives/AuthenticationGuard";
import { VaultNavigation } from "~/components/vault/VaultNavigation";
import { VaultHeader } from "~/components/vault/VaultHeader";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useHasRoleLevel } from "~/hooks/usePermissions";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "~/components/ui/sheet";

interface VaultLayoutProps {
  children: React.ReactNode;
}

function VaultLayoutContent({ children }: VaultLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { user } = useUser();
  const isAdmin = useHasRoleLevel(10); // Admin level or higher

  // Fetch user's IxCredits balance
  const { data: balanceData, isLoading, refetch } = api.vault.getBalance.useQuery(
    { userId: user?.id ?? "" },
    { enabled: !!user?.id && isAdmin }
  );

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
        <div className="glass-hierarchy-parent max-w-md w-full p-8 text-center space-y-4">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-red-400">Access Restricted</h1>
          <p className="text-muted-foreground">
            The IxCards/MyVault system is currently in development and restricted to administrators only.
          </p>
          <p className="text-sm text-muted-foreground/70">
            Please contact a system administrator if you need access to this feature.
          </p>
          <a
            href="/dashboard"
            className="inline-block mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Header */}
      <VaultHeader
        balance={balanceData?.balance ?? 0}
        loading={isLoading}
        onRefresh={() => void refetch()}
        onMenuClick={() => setMobileNavOpen(true)}
      />

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="glass-hierarchy-parent sticky top-16 hidden h-[calc(100vh-4rem)] w-64 border-r border-white/10 p-4 md:block">
          <VaultNavigation />
        </aside>

        {/* Mobile drawer */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-64 bg-black/95 p-4">
            <VaultNavigation onClose={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function VaultLayout({ children }: VaultLayoutProps) {
  return (
    <AuthenticationGuard redirectPath="/vault">
      <VaultLayoutContent>{children}</VaultLayoutContent>
    </AuthenticationGuard>
  );
}
