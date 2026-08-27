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
              url={`/id/@${username}`}
              labelIcon={<ExternalLink className="h-4 w-4" />}
            />
          </UserProfile>
        </div>
      </SignedIn>
      <SignedOut>
        <div className="border-border bg-card flex flex-col items-center justify-center gap-4 rounded-2xl border p-8 text-center backdrop-blur-xl">
          <Crown className="text-foreground h-10 w-10" />
          <h2 className="text-foreground text-xl font-bold tracking-tight">
            Sign in to Access IxnayID
          </h2>
          <p className="text-muted-foreground max-w-md text-xs">
            Manage your persistent digital passport, security credentials, and multi-tenant realm
            memberships.
          </p>
          <SignInButton mode="modal">
            <button
              type="button"
              className="facet-interactive bg-primary text-primary-foreground rounded-xl px-5 py-2.5 text-xs font-bold shadow-md hover:opacity-90 active:scale-[0.98]"
            >
              Sign In to IxStates
            </button>
          </SignInButton>
        </div>
      </SignedOut>
    </div>
  );
}
