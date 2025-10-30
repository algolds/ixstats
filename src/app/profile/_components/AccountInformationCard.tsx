import { useState } from "react";
import { User, CheckCircle, AlertCircle, Eye, EyeOff, Disc } from "lucide-react";
import { UserButton } from "~/context/auth-context";
import type { UserResource } from "@clerk/types";

interface AccountInformationCardProps {
  user: UserResource | null | undefined;
  setupStatus: "loading" | "unauthenticated" | "needs-setup" | "complete";
  hasDiscordAccount?: boolean;
}

export function AccountInformationCard({
  user,
  setupStatus,
  hasDiscordAccount,
}: AccountInformationCardProps) {
  const [showAccountInfo, setShowAccountInfo] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center">
          <User className="mr-2 h-5 w-5 text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Account Information
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAccountInfo(!showAccountInfo)}
            className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
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
                avatarBox: "h-8 w-8",
              },
            }}
          />
        </div>
      </div>

      <div
        className={`space-y-4 transition-all duration-300 ${showAccountInfo ? "opacity-100" : "pointer-events-none opacity-0 blur-sm"}`}
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Name
          </label>
          <p className="text-gray-900 dark:text-white">
            {user?.firstName} {user?.lastName}
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
          <p className="text-gray-900 dark:text-white">{user?.emailAddresses?.[0]?.emailAddress}</p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Discord Integration
          </label>
          <div className="flex items-center">
            <Disc className="mr-2 h-4 w-4 text-[#5865F2]" />
            {hasDiscordAccount ? (
              <div className="flex items-center">
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                <span className="text-green-700 dark:text-green-300">Connected to Discord</span>
              </div>
            ) : (
              <div className="flex items-center">
                <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
                <span className="text-amber-700 dark:text-amber-300">Not connected to Discord</span>
              </div>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Your account is managed through Discord authentication
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Account Status
          </label>
          <div className="flex items-center">
            {setupStatus === "complete" ? (
              <>
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                <span className="text-green-700 dark:text-green-300">Setup Complete</span>
              </>
            ) : (
              <>
                <AlertCircle className="mr-2 h-4 w-4 text-amber-500" />
                <span className="text-amber-700 dark:text-amber-300">Setup Required</span>
              </>
            )}
          </div>
        </div>
      </div>

      {!showAccountInfo && (
        <div className="py-4 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Click "Show" to reveal account information
          </p>
        </div>
      )}
    </div>
  );
}
