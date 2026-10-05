"use client";

// Lorewards live on the IxnayID passport (Overview tab and its Lorewards panel), not on
// Achievements: send a signed-in reader to their own passport, everyone else to sign in.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { useUser, SignedOut, SignInButton } from "~/context/auth-context";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";

export default function LorewardsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { data: status } = api.ixnayid.getStatus.useQuery(undefined, { enabled: !!user });

  useEffect(() => {
    if (!user || !status) return;
    const handle = status.passportHandle || user.username?.replace(/_$/, "");
    router.replace(handle ? `/id/${encodeURIComponent(handle)}` : "/id");
  }, [router, user, status]);

  if (!isLoaded || user) return null;
  return (
    <SignedOut>
      <EmptyState
        title="Sign in to see your Lorewards"
        message="Lorewards are listed on your IxnayID passport."
        action={
          <SignInButton>
            <Button>Sign in</Button>
          </SignInButton>
        }
      />
    </SignedOut>
  );
}
