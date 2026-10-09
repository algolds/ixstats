"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import {
  Sparks as Sparkles,
  WarningCircle as AlertCircle,
  SystemRestart as Loader2,
  HelpCircle,
} from "iconoir-react";

import { api } from "~/trpc/react";
import { mediaWikiImageUrl } from "~/lib/wiki-os/config";
import { useNotify } from "~/hooks/useNotify";
import { AccountTypeSelector } from "./form/AccountTypeSelector";
import { AccountDetailsForm } from "./form/AccountDetailsForm";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { Button, buttonVariants } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { springSmooth } from "~/lib/design/motion";
import { PersonaTraitControls } from "./form/PersonaTraitControls";
import { useUsernameAvailability } from "./form/useUsernameAvailability";

const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
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
  postingFrequency: "active" | "moderate" | "low";
  politicalLean: "left" | "center" | "right";
  personality: "serious" | "casual" | "satirical";
  profileImageUrl?: string;
}

const INITIAL_FORM: ThinkpagesAccountInput = {
  accountType: "citizen",
  firstName: "",
  lastName: "",
  username: "",
  bio: "",
  postingFrequency: "moderate",
  politicalLean: "center",
  personality: "serious",
  profileImageUrl: "",
};

/** A readable message for a failed createAccount call. */
function createAccountErrorMessage(error: any): string {
  if (error?.data?.code === "CONFLICT") return "An account with this username already exists";
  if (error?.data?.code === "BAD_REQUEST") {
    return error.data.message || "Invalid account information. Please check your entries.";
  }
  return error?.message || "Failed to create account";
}

function ModalHeader({
  countryName,
  accountsRemaining,
}: {
  countryName: string;
  accountsRemaining: number;
}) {
  return (
    <DialogHeader className="border-separator flex-row items-center gap-3 border-b px-4 py-3 text-left sm:px-6 sm:py-4">
      <div className="border-separator bg-surface-secondary rounded-row flex size-10 shrink-0 items-center justify-center overflow-hidden border p-2">
        <img
          src={mediaWikiImageUrl("/images/8/88/Thinkpages_Logo.svg")}
          alt="Thinkpages"
          className="size-full object-contain"
        />
      </div>
      <div>
        <DialogTitle className="text-title-3 flex items-center gap-2">
          <span>Create ThinkPages account</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-label-secondary hover:text-label"
                aria-label="ThinkPages help"
              >
                <HelpCircle aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs p-3">
              <p className="text-headline mb-1">About ThinkPages</p>
              <p className="text-callout">
                Thinkpages accounts allow your country to publish articles, share citizen opinions,
                official state press releases, or run news networks. Standard limits apply per
                category depending on your country's slots.
              </p>
            </TooltipContent>
          </Tooltip>
        </DialogTitle>
        <p className="text-footnote text-label-secondary">
          {countryName} •{" "}
          <span className="text-success font-medium tabular-nums">{accountsRemaining}</span> slots
          remaining
        </p>
      </div>
    </DialogHeader>
  );
}

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
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState<ThinkpagesAccountInput>(INITIAL_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showUnsplashSearch, setShowUnsplashSearch] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line
    setMounted(true);
  }, []);

  const createAccountMutation = api.thinkpages.createAccount.useMutation({
    onError: (error) => {
      console.error("[Account Creation Mutation] Error:", error);
    },
  });

  const {
    isUsernameAvailable,
    isCheckingUsername,
    isValidUsernameFormat,
    availability: usernameAvailability,
    isLoading: isLoadingUsernameAvailability,
    reset: resetUsernameAvailability,
  } = useUsernameAvailability(formData.username);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal is closed
      // oxlint-disable-next-line
      setStep("type");
      setFormData(INITIAL_FORM);
      setErrors({});
      resetUsernameAvailability();
      setShowAdvanced(false);
    }
    // oxlint-disable-next-line
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
    notify.success("Profile picture selected");
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
    if (formData.bio.length > 160) newErrors.bio = "Bio must be 160 characters or less";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateAccount = async () => {
    if (!validateForm()) return;

    try {
      const newAccount = await createAccountMutation.mutateAsync({
        ...formData,
        profileImageUrl: formData.profileImageUrl || undefined,
        countryId,
      });
      await utils.thinkpages.getMyAccounts.invalidate();
      await utils.thinkpages.getAccountCountsByType.invalidate({ countryId });
      notify.success("Account created");
      onAccountCreated(newAccount);
      onClose();
    } catch (error: any) {
      console.error("[Account Creation] Error:", error);
      notify.error(createAccountErrorMessage(error));

      if (error?.data?.code === "CONFLICT" && error?.data?.field === "username") {
        setErrors((prev) => ({ ...prev, username: "This username is already taken" }));
      }
    }
  };

  if (!mounted) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl md:max-w-2xl"
        aria-describedby={undefined}
      >
        <ModalHeader countryName={countryName} accountsRemaining={accountsRemaining} />

        {!canCreateMoreAccounts && (
          <div className="bg-destructive/10 rounded-row m-3 p-3 sm:m-4 sm:p-4">
            <div className="text-destructive flex items-center gap-2">
              <AlertCircle className="size-4" aria-hidden="true" />
              <span className="text-headline">Account limit reached</span>
            </div>
            <p className="text-footnote text-label-secondary mt-1 pl-6">
              You have reached the maximum of {maxAccounts} accounts. Delete an existing account to
              create a new one.
            </p>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <AnimatePresence mode="wait">
            {step === "type" ? (
              <motion.div
                key="type-selection"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
              >
                <AccountTypeSelector
                  selectedType={formData.accountType}
                  onSelectType={(t) =>
                    setFormData((prev) => ({
                      ...prev,
                      accountType: t,
                    }))
                  }
                  onContinue={() => setStep("details")}
                />
              </motion.div>
            ) : (
              <motion.div
                key="account-details"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-6"
              >
                <AccountDetailsForm
                  formData={formData}
                  setFormData={setFormData}
                  errors={errors}
                  isCheckingUsername={isCheckingUsername}
                  isUsernameAvailable={isUsernameAvailable}
                  isValidUsernameFormat={isValidUsernameFormat}
                  handleUsernameChange={handleUsernameChange}
                  onBack={() => setStep("type")}
                  onOpenImageSearch={() => setShowUnsplashSearch(true)}
                />
                <div className="border-separator border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    aria-expanded={showAdvanced}
                    className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
                  >
                    <Sparkles
                      aria-hidden="true"
                      className={cn(
                        "text-tint transition-transform duration-150",
                        showAdvanced && "rotate-180"
                      )}
                    />
                    <span>
                      {showAdvanced ? "Hide advanced settings" : "Show advanced settings"}
                    </span>
                  </button>

                  <AnimatePresence>
                    {showAdvanced && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={springSmooth}
                        className="mt-4 grid grid-cols-1 gap-4 overflow-hidden"
                      >
                        <PersonaTraitControls
                          idPrefix="tp-create"
                          size="sm"
                          values={formData}
                          onChange={(key, value) =>
                            setFormData((prev) => ({ ...prev, [key]: value }))
                          }
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="border-separator border-t px-4 py-3 sm:px-6 sm:py-4">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {step === "type" ? (
            <Button onClick={() => setStep("details")} disabled={!canCreateMoreAccounts}>
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleCreateAccount}
              disabled={
                !canCreateMoreAccounts ||
                !isUsernameAvailable ||
                Object.keys(errors).length > 0 ||
                isCheckingUsername ||
                createAccountMutation.isPending
              }
            >
              {createAccountMutation.isPending && <Loader2 className="animate-spin" />}
              Create account
            </Button>
          )}
        </DialogFooter>

        <MediaSearchModal
          isOpen={showUnsplashSearch}
          onClose={() => setShowUnsplashSearch(false)}
          onImageSelect={handleImageSelected}
        />
      </DialogContent>
    </Dialog>
  );
}
