import { useState } from "react";
import { User, CheckCircle, AlertCircle, Eye, EyeOff, Disc } from "lucide-react";
import { UserButton } from "~/context/auth-context";
import type { UserResource } from "@clerk/types";

interface AccountInformationCardProps {
  user: UserResource | null | undefined;
  setupStatus: 'loading' | 'unauthenticated' | 'needs-setup' | 'complete';
  hasDiscordAccount?: boolean;
}

export function AccountInformationCard({ user, setupStatus, hasDiscordAccount }: AccountInformationCardProps) {
  const [showAccountInfo, setShowAccountInfo] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <User className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Account Information
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAccountInfo(!showAccountInfo)}
            className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            {showAccountInfo ? (
              <>
                <EyeOff className="h-4 w-4" />
                Hide
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                Show
              </>
            )}
          </button>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "h-8 w-8"
              }
            }}
          />
        </div>
      </div>

      <div className={`space-y-4 transition-all duration-300 ${showAccountInfo ? 'opacity-100' : 'opacity-0 blur-sm pointer-events-none'}`}>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Name
          </label>
          <p className="text-gray-900 dark:text-white">
            {user?.firstName} {user?.lastName}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <p className="text-gray-900 dark:text-white">
            {user?.emailAddresses?.[0]?.emailAddress}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Discord Integration
          </label>
          <div className="flex items-center">
            <Disc className="h-4 w-4 text-[#5865F2] mr-2" />
            {hasDiscordAccount ? (
              <div className="flex items-center">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-green-700 dark:text-green-300">Connected to Discord</span>
              </div>
            ) : (
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-amber-500 mr-2" />
                <span className="text-amber-700 dark:text-amber-300">Not connected to Discord</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Your account is managed through Discord authentication
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Account Status
          </label>
          <div className="flex items-center">
            {setupStatus === 'complete' ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-green-700 dark:text-green-300">Setup Complete</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-amber-500 mr-2" />
                <span className="text-amber-700 dark:text-amber-300">Setup Required</span>
              </>
            )}
          </div>
        </div>
      </div>

      {!showAccountInfo && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Click "Show" to reveal account information
          </p>
        </div>
      )}
    </div>
  );
}
