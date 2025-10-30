import { BarChart3, Crown, Globe, Building } from "lucide-react";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";

interface QuickActionsSectionProps {
  setupStatus: "loading" | "unauthenticated" | "needs-setup" | "complete";
  countryId?: string;
  countrySlug?: string;
}

export function QuickActionsSection({
  setupStatus,
  countryId,
  countrySlug,
}: QuickActionsSectionProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h3>
      <div className="space-y-3">
        <Link
          href={createUrl("/dashboard")}
          className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          Dashboard
        </Link>

        {setupStatus === "complete" && countryId && (
          <Link
            href={createUrl(`/countries/${countrySlug || countryId}`)}
            className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Crown className="mr-2 h-4 w-4" />
            My Country
          </Link>
        )}

        <Link
          href={createUrl("/explore")}
          className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Globe className="mr-2 h-4 w-4" />
          Explore Countries
        </Link>

        <Link
          href={createUrl("/builder")}
          className="flex w-full items-center rounded-md px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          <Building className="mr-2 h-4 w-4" />
          Economy Builder
        </Link>
      </div>
    </div>
  );
}
