"use client";

/**
 * The sidebar's quiet footnote: version and build (to the changelog), Feedback, Privacy, Terms.
 * Feedback needs a session (the endpoint is protected), so it is signed-in only. The form mounts
 * only while the dialog is open, so its tRPC mutation and console-log capture cost nothing until
 * someone asks for it.
 */

import * as React from "react";
import Link from "next/link";

import { cn } from "~/lib/utils/cn";
import { focusRing } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { BUILD_VERSION, PLATFORM_VERSION } from "~/lib/buildVersion";
import { FeedbackModal } from "./FeedbackModal";

const linkClassName = cn(
  focusRing,
  "rounded-control-sm hover:text-label cursor-pointer transition-colors hover:underline"
);

export function SidebarFooterLinks({
  signedIn,
  className,
}: {
  signedIn: boolean;
  className?: string;
}) {
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);

  return (
    <div
      data-slot="sidebar-footer-links"
      className={cn(
        "text-caption text-label-secondary flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2.5 pt-1",
        className
      )}
    >
      <Link href="/changelog" className={cn(linkClassName, "tabular-nums")}>
        {`v${PLATFORM_VERSION} · ${BUILD_VERSION}`}
      </Link>
      {signedIn && (
        <>
          <button type="button" onClick={() => setFeedbackOpen(true)} className={linkClassName}>
            Feedback
          </button>
          <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
            <DialogContent>
              <FeedbackModal onClose={() => setFeedbackOpen(false)} />
            </DialogContent>
          </Dialog>
        </>
      )}
      <Link href="/privacy" className={linkClassName}>
        Privacy
      </Link>
      <Link href="/terms" className={linkClassName}>
        Terms
      </Link>
    </div>
  );
}
