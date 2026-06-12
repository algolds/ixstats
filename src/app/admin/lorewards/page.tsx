"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { withBasePath } from "~/lib/base-path";

export default function Page() {
  const router = useRouter();

  useEffect(() => {
    router.replace(withBasePath("/admin/bot"));
  }, [router]);

  return null;
}
