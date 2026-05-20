"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUrl } from "~/lib/url-utils";

/**
 * Legacy import page — redirects to the unified builder with import section active.
 */
export default function ImportFromWikiPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(createUrl("/builder?section=import"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Redirecting to MyCountry Builder...</div>
    </div>
  );
}
