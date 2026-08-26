// src/app/(wiki-os)/wiki/diff/page.tsx
"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { withBasePath } from "~/lib/base-path";

export default function WikiDiffRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(withBasePath(`/util/diff${qs ? `?${qs}` : ""}`));
  }, [searchParams, router]);

  return null;
}
