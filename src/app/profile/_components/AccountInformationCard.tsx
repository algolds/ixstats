import { useState } from "react";
import { User, CheckCircle, AlertCircle, Eye, EyeOff, Disc, Shield, MessageSquare, BookOpen, Link } from "lucide-react";
import { UserButton } from "~/context/auth-context";
import type { UserResource } from "@clerk/types";
import { api } from "~/trpc/react";

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
  const { data: ixnayStatus } = api.ixnayid.getStatus.useQuery();

  return (
    <div className="glass-surface glass-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Account Credentials
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAccountInfo(!showAccountInfo)}
              className="glass-interactive flex items-center gap-2 rounded-xl bg-white/50 px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-white dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
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
            <div className="rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9 rounded-lg",
                  },
                }}
              />
            </div>
          </div>
        </div>

        <div className="relative">
          <div
            className={`grid grid-cols-1 gap-6 transition-all duration-500 sm:grid-cols-2 ${
              showAccountInfo ? "opacity-100 translate-y-0" : "pointer-events-none translate-y-4 opacity-0 blur-xl"
            }`}
          >
            <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Legal Name
              </label>
              <p className="font-semibold text-slate-900 dark:text-white">
                {user?.firstName} {user?.lastName}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Primary Email
              </label>
              <p className="font-semibold text-slate-900 dark:text-white">
                {user?.emailAddresses?.[0]?.emailAddress}
              </p>
            </div>
          </div>

          {!showAccountInfo && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Shield className="h-5 w-5 text-slate-400" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Credentials Encrypted
              </p>
              <button 
                onClick={() => setShowAccountInfo(true)}
                className="mt-2 text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:underline dark:text-indigo-400"
              >
                Reveal
              </button>
            </div>
          )}
        </div>

        <div className="mt-8 border-t border-slate-100 pt-8 dark:border-slate-800">
          <div className="mb-4 flex items-center gap-2">
            <Link className="h-4 w-4 text-indigo-500" />
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 dark:text-white">IxnayID© </h3>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Forum Status */}
            <div className="rounded-2xl border border-slate-100 bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="mb-2 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-orange-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Forum</span>
              </div>
              {ixnayStatus?.forum.linked ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-3 w-3" /> VERIFIED
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Active since {new Date(ixnayStatus.forum.lastSync!).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 uppercase">Disconnected</span>
              )}
            </div>

            {/* Wiki Status */}
            <div className="rounded-2xl border border-slate-100 bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Wiki</span>
              </div>
              {ixnayStatus?.wiki.linked ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-3 w-3" /> VERIFIED
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Active since {new Date(ixnayStatus.wiki.lastSync!).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 uppercase">Disconnected</span>
              )}
            </div>

            {/* Discord Status */}
            <div className="rounded-2xl border border-slate-100 bg-white/50 p-4 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="mb-2 flex items-center gap-2">
                <Disc className="h-4 w-4 text-[#5865F2]" />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Discord</span>
              </div>
              {ixnayStatus?.discord.linked ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-3 w-3" /> VERIFIED
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Active since {new Date(ixnayStatus.discord.lastSync!).toLocaleDateString()}
                  </p>
                </div>
              ) : (
                <span className="text-[10px] font-bold text-slate-400 uppercase">Disconnected</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
