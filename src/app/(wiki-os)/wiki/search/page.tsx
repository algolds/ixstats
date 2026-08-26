// src/app/(wiki-os)/wiki/search/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { withBasePath } from "~/lib/base-path";

export default function WikiSearchRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(withBasePath(`/util/search${qs ? `?${qs}` : ""}`));
  }, [searchParams, router]);

  return null;
}
