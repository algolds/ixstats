"use client";

import { UserProfile } from "@clerk/nextjs";
import { Crown, OpenNewWindow as ExternalLink } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser, SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import { AccountIdentityPanel } from "~/app/settings/_components/panels/AccountIdentityPanel";
import { facetClerkAppearance } from "~/lib/clerk/theme";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";

export default function IdAccountHubPage() {
  const { user } = useUser();
  const { data: status } = api.ixnayid.getStatus.useQuery(undefined, { enabled: !!user });
  const username =
    status?.passportHandle ||
    status?.forum?.username ||
    status?.wiki?.username ||
    (user?.username ? user.username.replace(/_$/, "") : null) ||
    user?.username ||
    "me";

  usePageTitle({
    title: "IxnayID and account settings",
  });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col items-center justify-center px-4 py-6 md:px-8 md:py-10">
      <SignedIn>
        <div className="flex w-full justify-center">
          <UserProfile routing="hash" appearance={facetClerkAppearance}>
            <UserProfile.Page
              label="IxnayID and passport"
              url="ixnayid"
              labelIcon={<Crown className="size-4" />}
            >
              <div className="py-2">
                <AccountIdentityPanel user={user} />
              </div>
            </UserProfile.Page>
            <UserProfile.Link
              label="Public passport"
              url={`/@${username}`}
              labelIcon={<ExternalLink className="size-4" />}
            />
          </UserProfile>
        </div>
      </SignedIn>
      <SignedOut>
        <Card>
          <EmptyState
            icon={<Crown />}
            title="Sign in to use IxnayID"
            message="Your passport, security settings and realm memberships are on your account."
            action={
              <SignInButton mode="modal">
                <Button type="button">Sign in to IxStates</Button>
              </SignInButton>
            }
          />
        </Card>
      </SignedOut>
    </div>
  );
}
