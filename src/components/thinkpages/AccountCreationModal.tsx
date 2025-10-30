"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { MediaSearchModal } from "~/components/MediaSearchModal";
import { WikiSearch } from "./WikiSearch";

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

export function AccountCreationModal({
  isOpen,
  onClose,
  onAccountCreated,
  countryId,
  countryName,
  existingAccountCount,
  maxAccounts = 25,
}: AccountCreationModalProps) {
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
  const [imageSource, setImageSource] = useState<"unsplash" | "upload" | "wiki">("unsplash");
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState<boolean>(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const createAccountMutation = api.thinkpages.createAccount.useMutation();

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
    }
  }, [isOpen]);

  // Always allow account creation - backend will enforce the actual limit
  const canCreateMoreAccounts = true;
  const accountsRemaining = maxAccounts - existingAccountCount;

  const handleUsernameChange = (value: string) => {
    setFormData((prev) => ({ ...prev, username: value }));
    if (errors.username) setErrors((e) => ({ ...e, username: "" }));
  };

  const handleImageSelected = (imageUrl: string) => {
    setFormData((prev) => ({ ...prev, profileImageUrl: imageUrl }));
    setShowUnsplashSearch(false);
    toast.success("Profile picture selected!");
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (usernameAvailability?.isAvailable === false) {
      newErrors.username = "Username is not available or invalid";
    } else if (isLoadingUsernameAvailability) {
      newErrors.username = "Checking username availability...";
    }
    if (!formData.bio.trim()) newErrors.bio = "Bio is required";
    else if (formData.bio.length > 160) {
      newErrors.bio = "Bio must be 160 characters or less";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateAccount = async () => {
    if (!validateForm()) return;

    try {
      const newAccount = await createAccountMutation.mutateAsync({
        ...formData,
        countryId,
      });
      toast.success("Account created successfully!");
      onAccountCreated(newAccount);
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to create account");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="hs-overlay-backdrop-open:bg-black/50 fixed inset-0 z-[60] flex items-center justify-center">
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
            className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col"
          >
            <div className="flex flex-col rounded-xl border border-white/10 bg-neutral-900/50 shadow-lg backdrop-blur-xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-500/20 p-2">
                    <Sparkles className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Create Thinkpages Account</h3>
                    <p className="text-sm text-neutral-400">
                      {countryName} • {accountsRemaining} slots remaining
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {!canCreateMoreAccounts && (
                <div className="m-4 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    <span className="text-sm font-medium">Account Limit Reached</span>
                  </div>
                  <p className="mt-1 pl-7 text-xs text-red-300">
                    You have reached the maximum of {maxAccounts} accounts. Delete an existing
                    account to create a new one.
                  </p>
                </div>
              )}

              {/* Body */}
              <div className="overflow-x-visible overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                  {step === "type" ? (
                    <motion.div
                      key="type-selection"
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      className="space-y-4"
                    >
                      <h3 className="text-lg font-semibold text-white">Choose Account Type</h3>
                      <div className="grid gap-4">
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
                                "flex w-full items-start gap-4 rounded-lg border-2 p-4 text-left transition-all",
                                isSelected
                                  ? "border-blue-500 bg-blue-500/10"
                                  : "border-neutral-700 hover:border-blue-400 hover:bg-blue-500/5",
                                (!canCreateThisType || isLoadingAccountCountsByType) &&
                                  "cursor-not-allowed opacity-50"
                              )}
                            >
                              <div
                                className={cn(
                                  "rounded-lg p-2",
                                  `bg-${config.color}-500/20 text-${config.color}-400`
                                )}
                              >
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="flex-1">
                                <div className="mb-1 flex items-center gap-2">
                                  <h4 className="font-semibold text-white">{config.label}</h4>
                                  <span className="rounded-full bg-neutral-700 px-2 py-0.5 text-xs text-neutral-300">
                                    Max {config.maxAccounts}
                                  </span>
                                  {type === "government" && (
                                    <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                                      Auto-Verified
                                    </span>
                                  )}
                                </div>
                                <p className="mb-2 text-sm text-neutral-400">
                                  {config.description}
                                </p>
                                <p className="text-xs text-neutral-500">
                                  {canCreateThisType
                                    ? `Remaining: ${typeAccountsRemaining} / ${config.maxAccounts}`
                                    : `Limit Reached: ${config.maxAccounts} / ${config.maxAccounts}`}
                                </p>
                                <p className="text-xs text-neutral-500">
                                  Examples: {config.examples.join(", ")}
                                </p>
                              </div>
                              {isSelected && (
                                <div className="rounded-full bg-blue-500 p-1 text-white">
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
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setStep("type")}
                          className="rounded-full p-2 text-neutral-300 transition-colors hover:bg-white/10"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <h3 className="text-lg font-semibold text-white">Account Details</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-neutral-300">
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
                              "block w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-blue-500",
                              errors.firstName && "border-red-500"
                            )}
                          />
                          {errors.firstName && (
                            <p className="mt-1 text-xs text-red-400">{errors.firstName}</p>
                          )}
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-neutral-300">
                            Last Name
                          </label>
                          <input
                            type="text"
                            value={formData.lastName}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, lastName: e.target.value }))
                            }
                            placeholder="Enter last name"
                            className={cn(
                              "block w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-blue-500",
                              errors.lastName && "border-red-500"
                            )}
                          />
                          {errors.lastName && (
                            <p className="mt-1 text-xs text-red-400">{errors.lastName}</p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-300">
                          Username
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-3 flex items-center text-neutral-500">
                            @
                          </span>
                          <input
                            type="text"
                            value={formData.username}
                            onChange={(e) => handleUsernameChange(e.target.value)}
                            placeholder="username"
                            className={cn(
                              "block w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-4 py-3 pl-8 text-sm text-white focus:border-blue-500 focus:ring-blue-500",
                              errors.username && "border-red-500",
                              isUsernameAvailable && "border-green-500"
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
                          Bio
                        </label>
                        <textarea
                          value={formData.bio}
                          onChange={(e) => setFormData((p) => ({ ...p, bio: e.target.value }))}
                          placeholder="Describe this account..."
                          maxLength={160}
                          className={cn(
                            "block min-h-[80px] w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-blue-500",
                            errors.bio && "border-red-500"
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
                          Profile Picture
                        </label>
                        <div className="flex items-center gap-4">
                          <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-full border border-neutral-700">
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
                            <DropdownMenu>
                              <DropdownMenuTrigger className="bg-background hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 inline-flex h-9 items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium whitespace-nowrap shadow-xs transition-all disabled:pointer-events-none disabled:opacity-50">
                                Change Source
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="z-[80]">
                                <DropdownMenuItem onSelect={() => setImageSource("unsplash")}>
                                  Search Image Repository
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setImageSource("upload")}>
                                  Upload Image
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setImageSource("wiki")}>
                                  Search Wiki (IxWiki/IiWiki)
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {imageSource === "unsplash" && (
                              <button
                                type="button"
                                onClick={() => setShowUnsplashSearch(true)}
                                className="inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"
                              >
                                Search Image Repository
                              </button>
                            )}
                            {imageSource === "upload" && (
                              <div className="space-y-3">
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;

                                    // Validate file size (max 5MB)
                                    if (file.size > 5 * 1024 * 1024) {
                                      toast.error("Image must be smaller than 5MB");
                                      return;
                                    }

                                    // Validate file type
                                    const validTypes = [
                                      "image/png",
                                      "image/jpeg",
                                      "image/jpg",
                                      "image/gif",
                                      "image/webp",
                                      "image/svg+xml",
                                    ];
                                    if (!validTypes.includes(file.type)) {
                                      toast.error(
                                        "Please upload a valid image file (PNG, JPG, GIF, WEBP, or SVG)"
                                      );
                                      return;
                                    }

                                    setIsUploadingImage(true);

                                    try {
                                      // Convert to base64 data URL
                                      const reader = new FileReader();
                                      reader.onload = (event) => {
                                        const dataUrl = event.target?.result as string;
                                        handleImageSelected(dataUrl);
                                        toast.success("Image uploaded successfully!");
                                        setIsUploadingImage(false);
                                      };
                                      reader.onerror = () => {
                                        toast.error("Failed to read image file");
                                        setIsUploadingImage(false);
                                      };
                                      reader.readAsDataURL(file);
                                    } catch (error) {
                                      toast.error("Failed to upload image");
                                      setIsUploadingImage(false);
                                    }
                                  }}
                                  className="block w-full cursor-pointer text-sm text-gray-400 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
                                  disabled={isUploadingImage}
                                />
                                {isUploadingImage && (
                                  <div className="flex items-center gap-2 text-sm text-blue-400">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Uploading image...
                                  </div>
                                )}
                                <p className="text-xs text-gray-400">
                                  Max file size: 5MB. Supported formats: PNG, JPG, GIF, WEBP, SVG
                                </p>
                              </div>
                            )}
                            {imageSource === "wiki" && (
                              <WikiSearch onImageSelect={handleImageSelected} />
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-neutral-300">
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
                            className="block w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="low">Low</option>
                            <option value="moderate">Moderate</option>
                            <option value="active">Active</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-neutral-300">
                            Political Lean
                          </label>
                          <select
                            value={formData.politicalLean}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, politicalLean: e.target.value as any }))
                            }
                            className="block w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-neutral-300">
                            Personality
                          </label>
                          <select
                            value={formData.personality}
                            onChange={(e) =>
                              setFormData((p) => ({ ...p, personality: e.target.value as any }))
                            }
                            className="block w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="serious">Serious</option>
                            <option value="casual">Casual</option>
                            <option value="satirical">Satirical</option>
                          </select>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end border-t border-white/10 px-6 py-4">
                <div className="flex gap-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-neutral-700 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-600 disabled:pointer-events-none disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  {step === "type" ? (
                    <button
                      type="button"
                      onClick={() => setStep("details")}
                      disabled={!canCreateMoreAccounts}
                      className="inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCreateAccount}
                      disabled={
                        !isUsernameAvailable ||
                        Object.keys(errors).length > 0 ||
                        isCheckingUsername ||
                        createAccountMutation.isPending
                      }
                      className="inline-flex items-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"
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
