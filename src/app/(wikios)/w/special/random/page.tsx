// src/app/(wikios)/w/special/random/page.tsx
// WikiOS Random Page — fetches a random article server-side and redirects
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";

export default function RandomPage() {
  const router = useRouter();
  const { data, isLoading, refetch } = api.wikios.getRandomPage.useQuery(
    undefined,
    { staleTime: 0, refetchOnMount: "always" }
  );

  useEffect(() => {
    if (data?.title) {
      router.replace(withBasePath(`/w/${encodeURIComponent(data.title.replace(/ /g, "_"))}`));
    }
  }, [data, router]);

  return (
    <WikiOSLayout title="Random page">
      {isLoading || data?.title ? (
        <div className="wikios-loading">
          <div className="wikios-loading-spinner" />
          <p className="mt-4 text-sm text-zinc-400">Finding a random page...</p>
        </div>
      ) : (
        <div className="wikios-error glass-hierarchy-child rounded-lg p-6">
          <p className="text-sm text-zinc-400">
            Could not fetch a random page.
          </p>
          <button
            onClick={() => refetch()}
            className="wikios-action-btn mt-3"
          >
            Try again
          </button>
        </div>
      )}
    </WikiOSLayout>
  );
}
