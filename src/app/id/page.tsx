"use client";

import { UserProfile } from "@clerk/nextjs";
import { Crown, OpenNewWindow as ExternalLink } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser, SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import { AccountIdentityPanel } from "~/app/settings/_components/panels/AccountIdentityPanel";
import { facetClerkAppearance } from "~/lib/clerk/theme";
import { usePageTitle } from "~/hooks/usePageTitle";
import { Button } from "~/components/ui/button";

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
    title: "IxnayID & Account Settings",
  });

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col items-center justify-center px-4 py-6 md:px-8 md:py-10">
      <SignedIn>
        <div className="flex w-full justify-center">
          <UserProfile routing="hash" appearance={facetClerkAppearance}>
            <UserProfile.Page
              label="IxnayID & Passport"
              url="ixnayid"
              labelIcon={<Crown className="h-4 w-4" />}
            >
              <div className="py-2">
                <AccountIdentityPanel user={user} />
              </div>
            </UserProfile.Page>
            <UserProfile.Link
              label="Public Passport"
              url={`/@${username}`}
              labelIcon={<ExternalLink className="h-4 w-4" />}
            />
          </UserProfile>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="border-separator bg-surface rounded-card shadow-card flex flex-col items-center justify-center gap-4 border p-8 text-center">
          <Crown className="text-label h-10 w-10" />
          <h2 className="text-label text-title-2">Sign in to Access IxnayID</h2>
          <p className="text-label-secondary text-footnote max-w-md">
            Manage your persistent digital passport, security credentials, and multi-tenant realm
            memberships.
          </p>
          <SignInButton mode="modal">
            <Button type="button">Sign In to IxStates</Button>
          </SignInButton>
        </div>
      </SignedOut>
    </div>
  );
}
