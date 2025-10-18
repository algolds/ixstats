import { BarChart3, Crown, Globe, Building } from "lucide-react";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";

interface QuickActionsSectionProps {
  setupStatus: 'loading' | 'unauthenticated' | 'needs-setup' | 'complete';
  countryId?: string;
}

export function QuickActionsSection({ setupStatus, countryId }: QuickActionsSectionProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Quick Actions
      </h3>
      <div className="space-y-3">
        <Link
          href={createUrl("/dashboard")}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Dashboard
        </Link>

        {setupStatus === 'complete' && countryId && (
          <Link
            href={createUrl(`/nation/${countryId}`)}
            className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
          >
            <Crown className="h-4 w-4 mr-2" />
            My Country
          </Link>
        )}

        <Link
          href={createUrl("/explore")}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          <Globe className="h-4 w-4 mr-2" />
          Explore Countries
        </Link>

        <Link
          href={createUrl("/builder")}
          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
        >
          <Building className="h-4 w-4 mr-2" />
          Economy Builder
        </Link>
      </div>
    </div>
  );
}
