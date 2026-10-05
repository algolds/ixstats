"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button, buttonVariants } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

interface RepealPolicyButtonProps {
  policyId: string;
  policyName: string;
  onRepealed?: () => void;
}

/** Repeal an enacted policy (MC-5), behind a confirmation. Releases its CivCap. */
export function RepealPolicyButton({ policyId, policyName, onRepealed }: RepealPolicyButtonProps) {
  const notify = useNotify();
  const utils = api.useUtils();
  const repeal = api.policies.repealPolicy.useMutation({
    onSuccess: () => {
      notify.success("Law repealed", `"${policyName}" is no longer in force`);
      void utils.policies.getPolicyReconContext.invalidate();
      onRepealed?.();
    },
    onError: (error) => notify.error("Could not repeal", error.message),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="text-footnote h-6 px-3"
          disabled={repeal.isPending}
        >
          Repeal
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Repeal this law?</AlertDialogTitle>
          <AlertDialogDescription>
            &ldquo;{policyName}&rdquo; stops taking effect, releases the CivCap it holds and is no
            longer charged maintenance. Effects already applied stay in place.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() => repeal.mutate({ policyId })}
          >
            Repeal
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
