"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { useAuth } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { useInviteVia } from "./use-invite-via";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { ClaimConsent, consentInput, NO_CONSENT } from "./ClaimConsent";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";

/**
 * "Claim this nation" for an unclaimed nation of a realm (one its source sync created, or one released by its
 * player): the existing claim flow (`realms.claimCountry`). The verified creator of the nation's wiki page is
 * approved at once; anyone else waits for the realm's moderators. The claim waits for the realm content consent
 * and, when the realm has rules, for "I have read the realm's rules", as on the claimable pages list. Renders
 * nothing for signed-out viewers.
 */
export function ClaimNationButton({
  realmSlug,
  countryId,
  countryName,
  label = "Claim",
  size = "xs",
}: {
  realmSlug: string;
  countryId: string;
  countryName: string;
  label?: ReactNode;
  size?: "xs" | "sm";
}) {
  const { isSignedIn } = useAuth();
  const notify = useNotify();
  const utils = api.useUtils();
  // An invite link's handle (`?via=`) rides along with the claim.
  const via = useInviteVia();
  const [open, setOpen] = useState(false);
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [consent, setConsent] = useState(NO_CONSENT);
  const { data: overview, isLoading: rulesLoading } = api.realms.region.overview.useQuery(
    { slug: realmSlug },
    { enabled: open }
  );
  const rules = overview?.rules ?? null;
  const claim = api.realms.claimCountry.useMutation({
    onSuccess: (result) => {
      setOpen(false);
      // Every realm list (hub, claims, directory, search) shows claim state.
      void utils.realms.invalidate();
      if (result.status === "approved") {
        notify.success(`${countryName} is yours`, "Manage it from MyCountry.");
        // The country page and map read ownership from the country queries.
        void utils.countries.invalidate();
        void utils.users.getProfile.invalidate();
        return;
      }
      notify.info(
        "Claim submitted",
        "The realm's moderators will review it; verify your wiki account in Settings to be approved instantly."
      );
    },
    onError: (error) => notify.error("Claim failed", error.message),
  });

  if (!isSignedIn) return null;
  return (
    <>
      <Button size={size} variant="outline" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setAcceptedRules(false);
            setConsent(NO_CONSENT);
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Claim {countryName}?</AlertDialogTitle>
            <AlertDialogDescription>
              If your verified wiki account created {countryName}&apos;s wiki page, it is yours at
              once. Otherwise the realm&apos;s moderators review your claim.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ClaimConsent nationName={countryName} value={consent} onChange={setConsent} />
          {rules && (
            <div className="bg-fill-4 rounded-row flex flex-col gap-2 p-3">
              <Link
                href={`/r/${encodeURIComponent(realmSlug)}/rules`}
                className="text-tint text-footnote w-fit underline-offset-4 hover:underline"
              >
                Read the realm&apos;s rules
              </Link>
              <label className="text-label text-footnote flex items-center gap-2">
                <Checkbox
                  checked={acceptedRules}
                  onCheckedChange={(checked) => setAcceptedRules(checked === true)}
                />
                I have read the realm&apos;s rules
              </label>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              // The rules arrive with the overview: until then a claim would be refused for want of them.
              disabled={
                claim.isPending || rulesLoading || (!!rules && !acceptedRules) || !consent.accepted
              }
              onClick={() =>
                claim.mutate({
                  countryId,
                  consent: consentInput(consent),
                  ...(rules && { acceptedRules }),
                  ...(via && { via }),
                })
              }
            >
              Claim {countryName}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
