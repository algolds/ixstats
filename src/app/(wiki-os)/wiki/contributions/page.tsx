"use client";
// src/app/(wiki-os)/wiki/contributions/page.tsx

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { withBasePath } from "~/lib/base-path";

export default function WikiContributionsRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(withBasePath(`/util/contributions${qs ? `?${qs}` : ""}`));
  }, [searchParams, router]);

  return null;
}
