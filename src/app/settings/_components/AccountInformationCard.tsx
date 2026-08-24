import { useState } from "react";
import Link from "next/link";
import { Eye, EyeClosed as EyeOff, CompactDisc as Disc, ChatBubble as MessageSquare, OpenBook as BookOpen, Link as LinkIcon, User as UserIcon } from "iconoir-react";
import { UserButton } from "~/context/auth-context";
import type { UserResource } from "@clerk/types";
import { api } from "~/trpc/react";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { useUserCountry } from "~/hooks/useUserCountry";

interface AccountInformationCardProps {
  user: UserResource | null | undefined;
  setupStatus: "loading" | "unauthenticated" | "needs-setup" | "complete";
  hasDiscordAccount?: boolean;
}

export function AccountInformationCard({
  user,
  setupStatus: _setupStatus,
  hasDiscordAccount: _hasDiscordAccount,
}: AccountInformationCardProps) {
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [isDataRendered, setIsDataRendered] = useState(false);
  const [animState, setAnimState] = useState<"hidden" | "blurring" | "focusing" | "visible">(
    "hidden"
  );
  const { data: ixnayStatus } = api.ixnayid.getStatus.useQuery();
  const { userProfile } = useUserCountry();

  const passportHandle =
    user?.username ||
    ixnayStatus?.passportHandle ||
    ixnayStatus?.forum.username ||
    ixnayStatus?.wiki.username ||
    "me";
  const passportUrl = `/id/@${passportHandle}`;
  const countryFactbookUrl = userProfile?.country?.slug
    ? `/countries/${userProfile.country.slug}`
    : null;

  const handleToggle = () => {
    if (showAccountInfo) {
      setAnimState("blurring");
      setTimeout(() => {
        setIsDataRendered(false);
        setShowAccountInfo(false);
        setAnimState("focusing");
        setTimeout(() => {
          setAnimState("hidden");
        }, 50);
      }, 300);
    } else {
      setAnimState("blurring");
      setTimeout(() => {
        setIsDataRendered(true);
        setShowAccountInfo(true);
        setAnimState("focusing");
        setTimeout(() => {
          setAnimState("visible");
        }, 50);
      }, 300);
    }
  };

  const getBlurClass = () => {
    switch (animState) {
      case "hidden":
        return "blur-[5px] opacity-60 scale-[0.99] pointer-events-none select-none transition-all duration-300 ease-out";
      case "blurring":
        return "blur-[12px] opacity-0 scale-[0.97] pointer-events-none select-none transition-all duration-300 ease-in";
      case "focusing":
        return "blur-[12px] opacity-0 scale-[0.97] pointer-events-none select-none transition-none";
      case "visible":
        return "blur-0 opacity-100 scale-100 select-text transition-all duration-300 ease-out";
      default:
        return "blur-[5px] opacity-60 pointer-events-none select-none";
    }
  };

  return (
    <div className="facet-surface facet-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-white/40 p-5 dark:bg-slate-900/40">
        <TextureOverlay texture="dots" opacity={0.035} />

        {/* Header section - tighter margin */}
        <div className="relative z-10 mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Account Credentials
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href={passportUrl}
              className="facet-interactive flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-xs font-semibold text-blue-600 transition-all hover:bg-blue-500/20 dark:text-blue-400 active:scale-95"
            >
              <UserIcon className="h-3.5 w-3.5" />
              <span>IxnayID Passport</span>
            </Link>
            {countryFactbookUrl && (
              <Link
                href={countryFactbookUrl}
                className="facet-interactive hidden sm:flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-600 transition-all hover:bg-emerald-500/20 dark:text-emerald-400 active:scale-95"
              >
                <span>Factbook</span>
              </Link>
            )}
            <button
              onClick={handleToggle}
              disabled={animState === "blurring" || animState === "focusing"}
              className="facet-interactive flex items-center gap-1.5 rounded-lg bg-white/50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-800/50 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {showAccountInfo ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Show
                </>
              )}
            </button>
            <div className="rounded-lg border border-slate-200 bg-white/30 p-0.5 dark:border-slate-700">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "h-7 w-7 rounded-md",
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Credentials detail container - rack focused blur with strict data security compliance */}
        <div className="relative z-10">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/20 bg-slate-50/50 p-3.5 dark:bg-slate-800/30">
              <label className="mb-0.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase select-none dark:text-slate-500">
                First Name
              </label>
              <p
                className={`text-sm font-semibold text-slate-900 dark:text-white ${getBlurClass()}`}
                aria-hidden={!showAccountInfo}
              >
                {isDataRendered ? (user?.firstName ?? "") : "••••••••"}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/20 bg-slate-50/50 p-3.5 dark:bg-slate-800/30">
              <label className="mb-0.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase select-none dark:text-slate-500">
                Last Name
              </label>
              <p
                className={`text-sm font-semibold text-slate-900 dark:text-white ${getBlurClass()}`}
                aria-hidden={!showAccountInfo}
              >
                {isDataRendered ? (user?.lastName ?? "") : "••••••••"}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/20 bg-slate-50/50 p-3.5 dark:bg-slate-800/30">
              <label className="mb-0.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase select-none dark:text-slate-500">
                Username
              </label>
              <p
                className={`text-sm font-semibold text-slate-900 dark:text-white ${getBlurClass()}`}
                aria-hidden={!showAccountInfo}
              >
                {isDataRendered ? (user?.username ?? "") : "••••••••"}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-slate-200/20 bg-slate-50/50 p-3.5 dark:bg-slate-800/30">
              <label className="mb-0.5 block text-[9px] font-bold tracking-wider text-slate-400 uppercase select-none dark:text-slate-500">
                Primary Email
              </label>
              <p
                className={`text-sm font-semibold text-slate-900 dark:text-white ${getBlurClass()}`}
                aria-hidden={!showAccountInfo}
              >
                {isDataRendered
                  ? (user?.emailAddresses?.[0]?.emailAddress ?? "")
                  : "••••••••••••••••••••••"}
              </p>
            </div>
          </div>
        </div>

        {/* IxnayID section - tighter divider and padding */}
        <div className="relative z-10 mt-5 border-t border-slate-100 pt-5 dark:border-slate-800">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LinkIcon className="h-3.5 w-3.5 text-indigo-500" />
              <h3 className="text-xs font-bold tracking-widest text-slate-900 uppercase dark:text-white">
                IxnayID©
              </h3>
            </div>
            <Link
              href={passportUrl}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>View Passport</span>
              <span>→</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* Forum Status */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex min-w-0 items-center gap-2">
                <MessageSquare className="h-4 w-4 shrink-0 text-orange-500" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Forum</p>
                  {ixnayStatus?.forum.linked && ixnayStatus.forum.lastSync && (
                    <p className="truncate text-[9px] text-slate-400">
                      {new Date(ixnayStatus.forum.lastSync).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              {ixnayStatus?.forum.linked ? (
                <span className="shrink-0 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                  VERIFIED
                </span>
              ) : (
                <span className="shrink-0 text-[8px] font-bold text-slate-400 uppercase">LINK</span>
              )}
            </div>

            {/* Wiki Status */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex min-w-0 items-center gap-2">
                <BookOpen className="h-4 w-4 shrink-0 text-blue-500" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Wiki</p>
                  {ixnayStatus?.wiki.linked && ixnayStatus.wiki.lastSync && (
                    <p className="truncate text-[9px] text-slate-400">
                      {new Date(ixnayStatus.wiki.lastSync).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              {ixnayStatus?.wiki.linked ? (
                <span className="shrink-0 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                  VERIFIED
                </span>
              ) : (
                <span className="shrink-0 text-[8px] font-bold text-slate-400 uppercase">LINK</span>
              )}
            </div>

            {/* Discord Status */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
              <div className="flex min-w-0 items-center gap-2">
                <Disc className="h-4 w-4 shrink-0 text-discord" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Discord</p>
                  {ixnayStatus?.discord.linked && ixnayStatus.discord.lastSync && (
                    <p className="truncate text-[9px] text-slate-400">
                      {new Date(ixnayStatus.discord.lastSync).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              {ixnayStatus?.discord.linked ? (
                <span className="shrink-0 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400">
                  VERIFIED
                </span>
              ) : (
                <span className="shrink-0 text-[8px] font-bold text-slate-400 uppercase">LINK</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
