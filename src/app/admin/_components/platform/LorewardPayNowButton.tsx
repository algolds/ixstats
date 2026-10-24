"use client";
/** The admin's "Pay now": settles every recorded Loreward place (mint, grant, pay) and says what it paid. */
import { Coins } from "iconoir-react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { payNowToast } from "~/lib/lorewards/admin-toasts";

export function LorewardPayNowButton() {
  const notify = useNotify();
  const payNow = api.lorewards.payNow.useMutation({
    onSuccess: (result) => {
      const toast = payNowToast(result);
      notify[toast.tone](toast.title, toast.message);
    },
    onError: (err) => notify.error("Payouts failed", err.message),
  });

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => payNow.mutate()}
      disabled={payNow.isPending}
    >
      <Coins aria-hidden />
      {payNow.isPending ? "Paying..." : "Pay now"}
    </Button>
  );
}
