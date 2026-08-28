"use client";
// src/app/(wiki-os)/wiki/history/page.tsx

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { withBasePath } from "~/lib/base-path";

export default function WikiHistoryRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(withBasePath(`/util/history${qs ? `?${qs}` : ""}`));
  }, [searchParams, router]);

  return null;
}
