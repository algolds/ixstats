"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { withBasePath } from "@/lib/base-path";

export default function CardPacksRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace(withBasePath("/admin/ns-sync?tab=packs"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Redirecting to Card Management...</p>
    </div>
  );
}
