"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { User } from "iconoir-react";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { createAbsoluteUrl } from "~/lib/utils";
import { navigateWithBasePath } from "~/lib/base-path";
import { isStandaloneClient } from "~/lib/system/standalone-detection";
import { REDUCED_MOTION_FADE, tweenExit, tweenFast } from "~/lib/design/motion";
import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { HaloCloseButton, HaloEmpty, HaloWell } from "../shared/HaloViewParts";
import { NationSide } from "./NationSide";
import { PassportSide } from "./PassportSide";

type Side = "nation" | "passport";

const SIDES = [
  { value: "nation", label: "MyCountry" },
  { value: "passport", label: "Passport" },
] as const satisfies ReadonlyArray<{ value: Side; label: string }>;

const SIDE_KEY = "ixstats.halo-account-side";

/** The side used last in this browser; Nation when unknown. */
function readSide(): Side {
  try {
    return localStorage.getItem(SIDE_KEY) === "passport" ? "passport" : "nation";
  } catch {
    return "nation";
  }
}

function writeSide(side: Side) {
  try {
    localStorage.setItem(SIDE_KEY, side);
  } catch {
    // Storage unavailable: the switch just doesn't remember.
  }
}

/**
 * Halo's account panel, opened from the greeting: one panel with two sides. Nation is the realm and country you
 * play (the country actions sheet's parts); Passport is your whole IxnayID account (the Passport's front face).
 * Renders client-side only (Halo's expanded views are lazy, `ssr: false`), so reading storage here is safe.
 */
export function AccountView({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const reduceMotion = useFacetReducedMotion();
  const [chosen, setChosen] = useState<{ side: Side; explicit: boolean }>(() => ({
    side: readSide(),
    explicit: false,
  }));
  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    refetch,
  } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  const navigate = (path: string) => {
    onClose();
    navigateWithBasePath(path, router);
  };

  if (isLoaded && !user) return <SignedOutAccount onClose={onClose} />;

  const hasNation = !!profile?.countryId && !!profile.country;
  // Without a nation the Nation side only says so; open on the Passport instead until the viewer picks a side.
  const side: Side = !chosen.explicit && profile && !profile.countryId ? "passport" : chosen.side;
  const choose = (next: Side) => {
    setChosen({ side: next, explicit: true });
    writeSide(next);
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2">
        <SegmentedControl
          aria-label="Account"
          size="sm"
          fullWidth
          className="flex-1"
          value={side}
          onValueChange={choose}
          options={SIDES}
        />
        <HaloCloseButton onClick={onClose} />
      </div>

      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={side}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: reduceMotion ? REDUCED_MOTION_FADE : tweenExit }}
            transition={reduceMotion ? REDUCED_MOTION_FADE : tweenFast}
          >
            {side === "passport" ? (
              <PassportSide onClose={onClose} onNavigate={navigate} />
            ) : !isLoaded || profileLoading ? (
              <div className="space-y-2" role="status" aria-label="Loading your nation">
                <Skeleton className="rounded-row h-40 w-full" />
                <Skeleton className="rounded-row h-20 w-full" />
              </div>
            ) : profileError || (profile?.countryId && !profile.country) ? (
              <HaloWell>
                <HaloEmpty
                  title="Couldn't load your nation"
                  action={
                    <Button type="button" size="sm" onClick={() => void refetch()}>
                      Try again
                    </Button>
                  }
                />
              </HaloWell>
            ) : hasNation && profile.country ? (
              <NationSide
                country={{ id: profile.countryId!, name: profile.country.name }}
                membershipTier={profile.membershipTier}
                onNavigate={navigate}
                onClose={onClose}
              />
            ) : (
              <HaloWell>
                <HaloEmpty
                  title="You don't have a nation yet"
                  message="Found one to unlock MyCountry."
                  action={
                    <Button type="button" size="sm" onClick={() => navigate("/builder")}>
                      Found a nation
                    </Button>
                  }
                />
              </HaloWell>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SignedOutAccount({ onClose }: { onClose: () => void }) {
  const standalone = isStandaloneClient();
  return (
    <div className="space-y-3 p-3">
      <div className="flex justify-end">
        <HaloCloseButton onClick={onClose} />
      </div>
      <HaloWell>
        <HaloEmpty
          icon={<User />}
          title={standalone ? "Sign in with IxnayID to edit maps" : "Sign in with IxnayID"}
          action={
            <Button
              type="button"
              size="sm"
              onClick={() =>
                (window.location.href =
                  process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL || createAbsoluteUrl("/sign-in"))
              }
            >
              Sign in
            </Button>
          }
        />
      </HaloWell>
    </div>
  );
}
