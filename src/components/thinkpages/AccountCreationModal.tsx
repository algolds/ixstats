"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import {
  X,
  Crown,
  Newspaper,
  Users,
  Sparkles,
  Check,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";

import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { WikiSearch } from "./WikiSearch";
import { TextureOverlay } from "~/components/ui/texture-overlay";

// Dynamic import for heavy media search modal
const MediaSearchModal = dynamic(
  () => import("~/components/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

interface AccountCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated: (account: any) => void;
  countryId: string;
  countryName: string;
  existingAccountCount: number;
  maxAccounts?: number;
}

interface ThinkpagesAccountInput {
  accountType: "government" | "media" | "citizen";
  firstName: string;
  lastName: string;
  username: string;
  bio: string;
  verified: boolean;
  postingFrequency: "active" | "moderate" | "low";
  politicalLean: "left" | "center" | "right";
  personality: "serious" | "casual" | "satirical";
  profileImageUrl?: string;
}

const ACCOUNT_TYPES = {
  government: {
    icon: Crown,
    label: "Government",
    description: "Official government accounts (Presidential, ministerial, diplomatic)",
    maxAccounts: 5,
    color: "amber",
    examples: ["Presidential Office", "Minister of Foreign Affairs", "Ambassador to UN"],
  },
  media: {
    icon: Newspaper,
    label: "Media",
    description: "News organizations, journalists, and bloggers",
    maxAccounts: 10,
    color: "blue",
    examples: ["National News Network", "Political Reporter", "Economic Analyst"],
  },
  citizen: {
    icon: Users,
    label: "Citizens",
    description: "Activists, influencers, and common people",
    maxAccounts: 17,
    color: "green",
    examples: ["Student Activist", "Business Owner", "Cultural Influencer"],
  },
} as const;

const COLOR_CLASSES = {
  amber: "bg-amber-500/20 text-amber-400",
  blue: "bg-blue-500/20 text-blue-400",
  green: "bg-green-500/20 text-green-400",
} as const;

const TYPE_THEME_CLASSES = {
  government: {
    selected: "border-amber-500/50 bg-gradient-to-br from-amber-500/[0.12] to-amber-500/[0.02] shadow-[0_0_25px_rgba(245,158,11,0.12)] scale-[1.01]",
    unselected: "border-white/[0.06] bg-white/[0.01] hover:border-amber-500/25 hover:bg-amber-500/[0.02] hover:scale-[1.005]",
  },
  media: {
    selected: "border-blue-500/50 bg-gradient-to-br from-blue-500/[0.12] to-blue-500/[0.02] shadow-[0_0_25px_rgba(59,130,246,0.12)] scale-[1.01]",
    unselected: "border-white/[0.06] bg-white/[0.01] hover:border-blue-500/25 hover:bg-blue-500/[0.02] hover:scale-[1.005]",
  },
  citizen: {
    selected: "border-green-500/50 bg-gradient-to-br from-green-500/[0.12] to-green-500/[0.02] shadow-[0_0_25px_rgba(16,185,129,0.12)] scale-[1.01]",
    unselected: "border-white/[0.06] bg-white/[0.01] hover:border-green-500/25 hover:bg-green-500/[0.02] hover:scale-[1.005]",
  },
} as const;

export function AccountCreationModal({
  isOpen,
  onClose,
  onAccountCreated,
  countryId,
  countryName,
  existingAccountCount,
  maxAccounts = 25,
}: AccountCreationModalProps) {
  const utils = api.useContext();
  const notify = useNotify();
  const [step, setStep] = useState<"type" | "details">("type");
  const [formData, setFormData] = useState<ThinkpagesAccountInput>({
    accountType: "citizen",
    firstName: "",
    lastName: "",
    username: "",
    bio: "",
    verified: false,
    postingFrequency: "moderate",
    politicalLean: "center",
    personality: "serious",
    profileImageUrl: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showUnsplashSearch, setShowUnsplashSearch] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [imageSource, setImageSource] = useState<"unsplash" | "upload" | "wiki">("unsplash");
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const createAccountMutation = api.thinkpages.createAccount.useMutation({
    onError: (error) => {
      console.error("[Account Creation Mutation] Error:", error);
    },
  });

  // Username validation regex (must match backend)
  const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]*$/;
  const isValidUsernameFormat =
    formData.username.length >= 3 &&
    formData.username.length <= 20 &&
    usernameRegex.test(formData.username);

  const {
    data: usernameAvailability,
    isLoading: isLoadingUsernameAvailability,
    error: usernameCheckError,
  } = api.thinkpages.checkUsernameAvailability.useQuery(
    { username: formData.username },
    {
      enabled: isValidUsernameFormat,
      staleTime: 500,
      refetchOnWindowFocus: false,
      retry: false, // Don't retry on validation errors
    }
  );

  const { data: accountCountsByType, isLoading: isLoadingAccountCountsByType } =
    api.thinkpages.getAccountCountsByType.useQuery(
      { countryId },
      { enabled: isOpen, staleTime: Infinity }
    );

  useEffect(() => {
    if (formData.username.length < 3) {
      // Too short to check
      setIsUsernameAvailable(null);
      setIsCheckingUsername(false);
    } else if (!isValidUsernameFormat) {
      // Invalid format (doesn't start with letter, or has invalid characters)
      setIsUsernameAvailable(false);
      setIsCheckingUsername(false);
    } else if (isLoadingUsernameAvailability) {
      // Currently checking availability
      setIsCheckingUsername(true);
      // Don't change isUsernameAvailable yet
    } else if (usernameCheckError) {
      // Network or server error - don't set to false, keep as null to show neutral state
      setIsUsernameAvailable(null);
      setIsCheckingUsername(false);
      console.error("[Username Check] Error checking username:", usernameCheckError);
    } else if (usernameAvailability !== undefined) {
      // Got a response from the server
      setIsUsernameAvailable(usernameAvailability.isAvailable);
      setIsCheckingUsername(false);
    }
  }, [
    usernameAvailability,
    isLoadingUsernameAvailability,
    usernameCheckError,
    formData.username,
    isValidUsernameFormat,
  ]);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal is closed
      setStep("type");
      setFormData({
        accountType: "citizen",
        firstName: "",
        lastName: "",
        username: "",
        bio: "",
        verified: false,
        postingFrequency: "moderate",
        politicalLean: "center",
        personality: "serious",
        profileImageUrl: "",
      });
      setErrors({});
      setIsUsernameAvailable(null);
      setShowAdvanced(false);
    }
  }, [isOpen]);

  const accountsRemaining = Math.max(0, maxAccounts - existingAccountCount);
  const canCreateMoreAccounts = accountsRemaining > 0;

  const handleUsernameChange = (value: string) => {
    setFormData((prev) => ({ ...prev, username: value }));
    if (errors.username) setErrors((e) => ({ ...e, username: "" }));
  };

  const handleImageSelected = (imageUrl: string) => {
    setFormData((prev) => ({ ...prev, profileImageUrl: imageUrl }));
    setShowUnsplashSearch(false);
    notify.success("Profile picture selected!");
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (usernameAvailability?.isAvailable === false) {
      newErrors.username = "Username is not available or invalid";
    } else if (isLoadingUsernameAvailability) {
      newErrors.username = "Checking username availability...";
    }
    if (formData.bio.trim() && formData.bio.length > 160) {
      newErrors.bio = "Bio must be 160 characters or less";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateAccount = async () => {
    if (!validateForm()) return;

    try {
      const submitData = {
        ...formData,
        profileImageUrl: formData.profileImageUrl || undefined,
      };

      const newAccount = await createAccountMutation.mutateAsync({
        ...submitData,
        countryId,
      });
      await utils.thinkpages.getMyAccounts.invalidate();
      await utils.thinkpages.getAccountCountsByType.invalidate({ countryId });
      notify.success("Account created successfully!");
      onAccountCreated(newAccount);
      onClose();
    } catch (error: any) {
      // Provide more specific error messages
      let errorMessage = "Failed to create account";

      if (error?.data?.code === "CONFLICT") {
        errorMessage = "An account with this username already exists";
      } else if (error?.data?.code === "BAD_REQUEST") {
        errorMessage =
          error?.data?.message || "Invalid account information. Please check your entries.";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      console.error("[Account Creation] Error:", error);
      notify.error(errorMessage);

      // Set form error if username conflict
      if (error?.data?.code === "CONFLICT" && error?.data?.field === "username") {
        setErrors((prev) => ({ ...prev, username: "This username is already taken" }));
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="hs-overlay-backdrop-open:bg-black/50 fixed inset-0 z-[100000] flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative mx-2 flex max-h-[90vh] w-full max-w-[95vw] flex-col sm:mx-4 sm:max-w-xl md:max-w-2xl"
          >
            <div className="relative flex flex-col rounded-2xl glass-modal glass-refraction overflow-hidden shadow-2xl">
              <TextureOverlay texture="dots" opacity={0.03} />

              {/* Header */}
              <div className="relative z-10 flex items-center justify-between border-b border-white/[0.08] px-4 py-3 sm:px-6 sm:py-4 bg-white/[0.01]">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="rounded-xl bg-gradient-to-br from-blue-500/30 to-indigo-500/10 p-2 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                    <Sparkles className="h-5 w-5 text-blue-400 sm:h-6 sm:w-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white tracking-wide sm:text-lg bg-gradient-to-r from-white via-neutral-100 to-neutral-400 bg-clip-text text-transparent">
                      Create Thinkpages Account
                    </h3>
                    <p className="text-xs font-medium text-neutral-400 sm:text-sm">
                      {countryName} • <span className="text-emerald-400 font-semibold">{accountsRemaining}</span> slots remaining
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-neutral-400 transition-all duration-200 hover:bg-white/10 hover:text-white hover:rotate-90 active:scale-95"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!canCreateMoreAccounts && (
                <div className="m-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 sm:m-4 sm:p-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="text-xs font-medium sm:text-sm">Account Limit Reached</span>
                  </div>
                  <p className="mt-1 pl-6 text-[10px] text-red-300 sm:pl-7 sm:text-xs">
                    You have reached the maximum of {maxAccounts} accounts. Delete an existing
                    account to create a new one.
                  </p>
                </div>
              )}

              {/* Body */}
              <div className="overflow-x-visible overflow-y-auto p-4 sm:p-6">
                <AnimatePresence mode="wait">
                  {step === "type" ? (
                    <motion.div
                      key="type-selection"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      className="space-y-4"
                    >
                      <h3 className="text-base font-semibold text-white sm:text-lg">
                        Choose Account Type
                      </h3>
                      <div className="grid gap-3 sm:gap-4">
                        {Object.entries(ACCOUNT_TYPES).map(([type, config]) => {
                          const Icon = config.icon;
                          const isSelected = formData.accountType === type;
                          const currentCount =
                            accountCountsByType?.[type as keyof typeof ACCOUNT_TYPES] || 0;
                          const canCreateThisType = currentCount < config.maxAccounts;
                          const typeAccountsRemaining = config.maxAccounts - currentCount;

                          return (
                            <button
                              key={type}
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  accountType: type as any,
                                  verified: type === "government",
                                }))
                              }
                              disabled={!canCreateThisType || isLoadingAccountCountsByType}
                              className={cn(
                                "flex w-full items-start gap-2 rounded-xl border p-3 text-left transition-all duration-300 sm:gap-4 sm:p-4",
                                isSelected
                                  ? TYPE_THEME_CLASSES[type as keyof typeof TYPE_THEME_CLASSES].selected
                                  : TYPE_THEME_CLASSES[type as keyof typeof TYPE_THEME_CLASSES].unselected,
                                (!canCreateThisType || isLoadingAccountCountsByType) &&
                                  "cursor-not-allowed opacity-40 hover:scale-100 border-neutral-800 bg-neutral-900/10"
                              )}
                            >
                              <div
                                className={cn(
                                  "rounded-xl p-2.5 transition-all duration-300 border border-transparent shrink-0",
                                  isSelected
                                    ? config.color === "amber"
                                      ? "bg-amber-500/25 text-amber-300 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
                                      : config.color === "blue"
                                      ? "bg-blue-500/25 text-blue-300 border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                                      : "bg-green-500/25 text-green-300 border-green-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                                    : COLOR_CLASSES[config.color]
                                )}
                              >
                                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                              </div>
                              <div className="flex-1">
                                <div className="mb-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
                                  <h4 className="text-sm font-semibold text-white sm:text-base">
                                    {config.label}
                                  </h4>
                                  <span className="rounded-full bg-white/5 border border-white/5 px-2 py-0.5 text-[10px] text-neutral-300 sm:text-xs">
                                    Max {config.maxAccounts}
                                  </span>
                                  {type === "government" && (
                                    <span className="rounded-full bg-blue-500/15 border border-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400 font-semibold sm:text-xs">
                                      Auto-Verified
                                    </span>
                                  )}
                                </div>
                                <p className="mb-2 text-xs text-neutral-400 sm:text-sm">
                                  {config.description}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-neutral-500 sm:text-xs">
                                  <span>
                                    {canCreateThisType
                                      ? `Remaining: ${typeAccountsRemaining} / ${config.maxAccounts}`
                                      : `Limit Reached: ${config.maxAccounts} / ${config.maxAccounts}`}
                                  </span>
                                  <span className="text-neutral-600">•</span>
                                  <span className="text-neutral-500 truncate max-w-[280px]">
                                    Examples: {config.examples.join(", ")}
                                  </span>
                                </div>
                              </div>
                              {isSelected && (
                                <div className={cn(
                                  "rounded-full p-1 text-white shadow-sm shrink-0",
                                  config.color === "amber" ? "bg-amber-500" : config.color === "blue" ? "bg-blue-500" : "bg-green-500"
                                )}>
                                  <Check className="h-4 w-4" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="account-details"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <button
                          onClick={() => setStep("type")}
                          className="rounded-full p-1.5 text-neutral-300 transition-all duration-200 hover:bg-white/10 hover:text-white sm:p-2 active:scale-95"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <h3 className="text-base font-semibold text-white sm:text-lg">
                          Account Details
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                        <div>
                          <label className="mb-2 block text-xs font-medium text-neutral-300 sm:text-sm">
                            First Name
                          </label>
                          <input
                            type="text"
                            value={formData.firstName}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, firstName: e.target.value }))
                            }
                            placeholder="Enter first name"
                            className={cn(
                              "block w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-xs text-white placeholder-neutral-500 backdrop-blur-sm transition-all duration-200 hover:border-white/20 focus:border-blue-500/60 focus:bg-white/[0.05] focus:ring-1 focus:ring-blue-500/30 sm:px-4 sm:py-3 sm:text-sm",
                              errors.firstName && "border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
                            )}
                          />
                          {errors.firstName && (
                            <p className="mt-1 text-[10px] text-red-400 sm:text-xs">
                              {errors.firstName}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-medium text-neutral-300 sm:text-sm">
                            Last Name (optional)
                          </label>
                          <input
                            type="text"
                            value={formData.lastName}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, lastName: e.target.value }))
                            }
                            placeholder="Enter last name"
                            className={cn(
                              "block w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-xs text-white placeholder-neutral-500 backdrop-blur-sm transition-all duration-200 hover:border-white/20 focus:border-blue-500/60 focus:bg-white/[0.05] focus:ring-1 focus:ring-blue-500/30 sm:px-4 sm:py-3 sm:text-sm",
                              errors.lastName && "border-red-500/50 focus:border-red-500 focus:ring-red-500/30"
                            )}
                          />
                          {errors.lastName && (
                            <p className="mt-1 text-[10px] text-red-400 sm:text-xs">
                              {errors.lastName}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-medium text-neutral-300 sm:text-sm">
                          Username
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-2 flex items-center text-xs text-neutral-500 sm:left-3 sm:text-sm">
                            @
                          </span>
                          <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => handleUsernameChange(e.target.value)}
                            placeholder="username"
                            className={cn(
                              "block w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 pl-6 text-xs text-white placeholder-neutral-500 backdrop-blur-sm transition-all duration-200 hover:border-white/20 focus:border-blue-500/60 focus:bg-white/[0.05] focus:ring-1 focus:ring-blue-500/30 sm:px-4 sm:py-3 sm:pl-8 sm:text-sm",
                              errors.username && "border-red-500/50 focus:border-red-500/30",
                              isUsernameAvailable && "border-green-500/50 focus:border-green-500/30"
                            )}
                          />
                          <div className="absolute inset-y-0 right-3 flex items-center">
                            {isCheckingUsername && (
                              <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
                            )}
                            {isUsernameAvailable === true && (
                              <Check className="h-5 w-5 text-green-500" />
                            )}
                            {isUsernameAvailable === false && !errors.username && (
                              <AlertCircle className="h-5 w-5 text-red-500" />
                            )}
                          </div>
                        </div>
                        {errors.username ? (
                          <p className="mt-1 text-xs text-red-400">{errors.username}</p>
                        ) : isUsernameAvailable === true ? (
                          <p className="mt-1 text-xs text-green-400">Username is available</p>
                        ) : isUsernameAvailable === false && formData.username.length >= 3 ? (
                          !isValidUsernameFormat ? (
                            <p className="mt-1 text-xs text-red-400">
                              Username must start with a letter and contain only letters, numbers,
                              and underscores
                            </p>
                          ) : (
                            <p className="mt-1 text-xs text-red-400">Username is already taken</p>
                          )
                        ) : (
                          <p className="mt-1 text-xs text-neutral-500">
                            3-20 characters, must start with a letter, letters/numbers/underscores
                            only
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-300">
                          Bio (optional)
                        </label>
                        <textarea
                          value={formData.bio}
                          onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))}
                          placeholder="Describe this account..."
                          maxLength={160}
                          className={cn(
                            "block min-h-[90px] w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-white placeholder-neutral-500 backdrop-blur-sm transition-all duration-200 hover:border-white/20 focus:border-blue-500/60 focus:bg-white/[0.05] focus:ring-1 focus:ring-blue-500/30",
                            errors.bio && "border-red-500/50 focus:border-red-500/30"
                          )}
                        />
                        <div className="mt-1 flex items-center justify-between">
                          {errors.bio ? (
                            <p className="text-xs text-red-400">{errors.bio}</p>
                          ) : (
                            <span />
                          )}
                          <span className="text-xs text-neutral-500">
                            {formData.bio.length}/160
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-300">
                          Profile Picture (optional)
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-white/10 bg-white/[0.02] shadow-[0_0_20px_rgba(255,255,255,0.05)] transition-all duration-300 hover:border-blue-500/30 hover:shadow-[0_0_25px_rgba(59,130,246,0.1)]">
                            {formData.profileImageUrl ? (
                              <img
                                src={formData.profileImageUrl}
                                alt="Profile"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-xs text-neutral-500">
                                No Image
                              </div>
                            )}
                          </div>
                          <div className="relative flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => setShowUnsplashSearch(true)}
                              className="inline-flex items-center gap-x-2 rounded-xl border border-blue-500/30 bg-blue-600/10 px-4 py-2.5 text-sm font-semibold text-blue-400 transition-all duration-300 hover:bg-blue-600/20 hover:text-blue-300 hover:scale-[1.02] active:scale-[0.98] shadow-md shadow-blue-500/5"
                            >
                              Search Image Repository
                            </button>
                            {formData.profileImageUrl && (
                              <button
                                type="button"
                                onClick={() => setFormData((p) => ({ ...p, profileImageUrl: "" }))}
                                className="inline-flex items-center justify-center gap-x-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-semibold text-neutral-400 transition-all duration-200 hover:bg-white/5 hover:text-white"
                              >
                                Remove Image
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-white/5 pt-4">
                        <button
                          type="button"
                          onClick={() => setShowAdvanced(!showAdvanced)}
                          className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.01] px-4 py-2 text-xs font-semibold text-neutral-400 transition-all hover:bg-white/[0.04] hover:text-white"
                        >
                          <Sparkles className={cn("h-3.5 w-3.5 text-blue-400 transition-transform duration-500", showAdvanced && "rotate-180")} />
                          <span>
                            {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
                          </span>
                        </button>

                        <AnimatePresence>
                          {showAdvanced && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="mt-4 grid grid-cols-1 gap-3 overflow-hidden sm:grid-cols-3 sm:gap-4"
                            >
                              <div>
                                <label className="mb-2 block text-xs font-medium text-neutral-300">
                                  Posting Frequency
                                </label>
                                <select
                                  value={formData.postingFrequency}
                                  onChange={(e) =>
                                    setFormData((p) => ({
                                      ...p,
                                      postingFrequency: e.target.value as any,
                                    }))
                                  }
                                  className="block w-full rounded-xl border border-white/[0.08] bg-neutral-950/40 px-4 py-3 text-sm text-white backdrop-blur-sm transition-all duration-200 hover:border-white/20 focus:border-blue-500/60 focus:bg-neutral-950/60 focus:ring-1 focus:ring-blue-500/30"
                                >
                                  <option value="low">Low</option>
                                  <option value="moderate">Moderate</option>
                                  <option value="active">Active</option>
                                </select>
                              </div>
                              <div>
                                <label className="mb-2 block text-xs font-medium text-neutral-300">
                                  Political Lean
                                </label>
                                <select
                                  value={formData.politicalLean}
                                  onChange={(e) =>
                                    setFormData((p) => ({
                                      ...p,
                                      politicalLean: e.target.value as any,
                                    }))
                                  }
                                  className="block w-full rounded-xl border border-white/[0.08] bg-neutral-950/40 px-4 py-3 text-sm text-white backdrop-blur-sm transition-all duration-200 hover:border-white/20 focus:border-blue-500/60 focus:bg-neutral-950/60 focus:ring-1 focus:ring-blue-500/30"
                                >
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </select>
                              </div>
                              <div>
                                <label className="mb-2 block text-xs font-medium text-neutral-300">
                                  Personality
                                </label>
                                <select
                                  value={formData.personality}
                                  onChange={(e) =>
                                    setFormData((p) => ({
                                      ...p,
                                      personality: e.target.value as any,
                                    }))
                                  }
                                  className="block w-full rounded-xl border border-white/[0.08] bg-neutral-950/40 px-4 py-3 text-sm text-white backdrop-blur-sm transition-all duration-200 hover:border-white/20 focus:border-blue-500/60 focus:bg-neutral-950/60 focus:ring-1 focus:ring-blue-500/30"
                                >
                                  <option value="serious">Serious</option>
                                  <option value="casual">Casual</option>
                                  <option value="satirical">Satirical</option>
                                </select>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="relative z-10 flex items-center justify-end border-t border-white/[0.08] px-4 py-3 sm:px-6 sm:py-4 bg-white/[0.01]">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center justify-center gap-x-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-xs font-semibold text-neutral-300 transition-all duration-200 hover:bg-white/[0.08] hover:text-white active:scale-[0.98] sm:px-5 sm:text-sm"
                  >
                    Cancel
                  </button>
                  {step === "type" ? (
                    <button
                      type="button"
                      onClick={() => setStep("details")}
                      disabled={!canCreateMoreAccounts}
                      className="inline-flex items-center justify-center gap-x-2 rounded-xl border border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition-all duration-300 hover:from-blue-500 hover:to-indigo-500 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] disabled:pointer-events-none disabled:opacity-40 sm:px-5 sm:text-sm"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCreateAccount}
                      disabled={
                        !canCreateMoreAccounts ||
                        !isUsernameAvailable ||
                        Object.keys(errors).length > 0 ||
                        isCheckingUsername ||
                        createAccountMutation.isPending
                      }
                      className="inline-flex items-center justify-center gap-x-2 rounded-xl border border-transparent bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-semibold text-white transition-all duration-300 hover:from-blue-500 hover:to-indigo-500 hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] disabled:pointer-events-none disabled:opacity-40 sm:px-5 sm:text-sm"
                    >
                      {createAccountMutation.isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      Create Account
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          <MediaSearchModal
            isOpen={showUnsplashSearch}
            onClose={() => setShowUnsplashSearch(false)}
            onImageSelect={handleImageSelected}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
