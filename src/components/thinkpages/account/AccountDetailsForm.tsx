"use client";

import { ArrowLeft, Check, WarningCircle as AlertCircle, SystemRestart as Loader2 } from "iconoir-react";
import { cn } from "~/lib/utils";

export interface AccountDetailsFormProps {
  formData: {
    firstName: string;
    lastName: string;
    username: string;
    bio: string;
    verified: boolean;
    postingFrequency: "active" | "moderate" | "low";
    politicalLean: "left" | "center" | "right";
    personality: "serious" | "casual" | "satirical";
    profileImageUrl?: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  errors: Record<string, string>;
  isCheckingUsername: boolean;
  isUsernameAvailable: boolean | null;
  isValidUsernameFormat: boolean;
  handleUsernameChange: (username: string) => void;
  onBack: () => void;
  onOpenImageSearch: () => void;
  className?: string;
}

export function AccountDetailsForm({
  formData,
  setFormData,
  errors,
  isCheckingUsername,
  isUsernameAvailable,
  isValidUsernameFormat,
  handleUsernameChange,
  onBack,
  onOpenImageSearch,
  className,
}: AccountDetailsFormProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="rounded-full p-2 text-slate-400 transition-all duration-150 hover:bg-white/10 hover:text-white active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h3 className="text-base font-bold tracking-tight text-white">Account Details</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-300">First Name</label>
          <input
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData((p: any) => ({ ...p, firstName: e.target.value }))}
            placeholder="Enter first name"
            className={cn(
              "block w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 focus:outline-none",
              errors.firstName && "border-rose-500"
            )}
          />
          {errors.firstName && <p className="mt-1 text-[10px] text-rose-400">{errors.firstName}</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-300">
            Last Name (optional)
          </label>
          <input
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData((p: any) => ({ ...p, lastName: e.target.value }))}
            placeholder="Enter last name"
            className="block w-full rounded-xl border border-white/10 bg-black/40 px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 focus:outline-none"
          />
        </div>
      </div>

      {/* Username Handle */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-300">Username Handle</label>
        <div className="relative">
          <span className="absolute inset-y-0 left-3 flex items-center text-xs text-slate-500">
            @
          </span>
          <input
            type="text"
            value={formData.username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            placeholder="username"
            className={cn(
              "block w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pr-10 pl-8 text-xs text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 focus:outline-none",
              errors.username && "border-rose-500",
              isUsernameAvailable && "border-emerald-500"
            )}
          />
          <div className="absolute inset-y-0 right-3 flex items-center">
            {isCheckingUsername && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            {isUsernameAvailable === true && <Check className="h-4 w-4 text-emerald-400" />}
            {isUsernameAvailable === false && !errors.username && (
              <AlertCircle className="h-4 w-4 text-rose-400" />
            )}
          </div>
        </div>
        {errors.username ? (
          <p className="mt-1 text-xs text-rose-400">{errors.username}</p>
        ) : isUsernameAvailable === true ? (
          <p className="mt-1 text-xs text-emerald-400">Username handle is available</p>
        ) : isUsernameAvailable === false && formData.username.length >= 3 ? (
          <p className="mt-1 text-xs text-rose-400">
            {!isValidUsernameFormat
              ? "Must start with a letter (letters, numbers, underscores only)"
              : "Username is already taken"}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">
            3-20 characters, letters, numbers, and underscores
          </p>
        )}
      </div>

      {/* Bio */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-300">Bio (optional)</label>
        <textarea
          value={formData.bio}
          onChange={(e) => setFormData((p: any) => ({ ...p, bio: e.target.value }))}
          placeholder="Describe this account..."
          maxLength={160}
          className="block min-h-[80px] w-full rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white placeholder:text-slate-500 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/30 focus:outline-none"
        />
        <div className="mt-1 text-right text-[10px] text-slate-500">{formData.bio.length}/160</div>
      </div>

      {/* Profile Image Picker */}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-300">
          Profile Image (optional)
        </label>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/50">
            {formData.profileImageUrl ? (
              <img
                src={formData.profileImageUrl}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
                No Image
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={onOpenImageSearch}
              className="rounded-xl border border-purple-500/30 bg-purple-500/15 px-3.5 py-2 text-xs font-semibold text-purple-300 transition-colors hover:bg-purple-500/25 active:scale-[0.96]"
            >
              Search Repository
            </button>
            {formData.profileImageUrl && (
              <button
                type="button"
                onClick={() => setFormData((p: any) => ({ ...p, profileImageUrl: "" }))}
                className="text-xs font-medium text-rose-400 hover:underline"
              >
                Remove Image
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
