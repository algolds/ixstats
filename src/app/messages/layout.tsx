import { Suspense } from "react";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Messages - IxStates",
  description: "Unified messaging",
};

/**
 * Messages lives under Home in the sidebar, so it wears Home's ink: no `data-app` scope here. The wrapper starts below
 * Halo's band and holds the page's one `<h1>`, which the inbox rail's own "Messages" label stands in for on screen.
 */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 pt-(--shell-top-offset) pb-4 sm:px-6">
      <h1 className="sr-only">Messages</h1>
      {/* The router reads ?conversation= and friends, which needs a Suspense boundary. */}
      <Suspense fallback={null}>{children}</Suspense>
    </div>
  );
}
