"use client";

import { UserProfile } from "@clerk/nextjs";
import { Crown, OpenNewWindow as ExternalLink } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser, SignedIn, SignedOut, SignInButton } from "~/context/auth-context";
import { AccountIdentityPanel } from "~/app/settings/_components/panels/AccountIdentityPanel";
import { facetClerkAppearance } from "~/lib/clerk/theme";
import { usePageTitle } from "~/hooks/usePageTitle";

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
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col items-center justify-center py-6 px-4 md:py-10 md:px-8">
      <SignedIn>
        <div className="w-full flex justify-center">
          <UserProfile
            routing="hash"
            appearance={facetClerkAppearance}
          >
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
              url={`/id/@${username}`}
              labelIcon={<ExternalLink className="h-4 w-4" />}
            />
          </UserProfile>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-8 text-center backdrop-blur-xl">
          <Crown className="h-10 w-10 text-foreground" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">Sign in to Access IxnayID</h2>
          <p className="max-w-md text-xs text-muted-foreground">
            Manage your persistent digital passport, security credentials, and multi-tenant realm memberships.
          </p>
          <SignInButton mode="modal">
            <button
              type="button"
              className="facet-interactive rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 active:scale-[0.98]"
            >
              Sign In to IxStates
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </div>
  );
}
