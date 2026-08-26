"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Xmark as X, SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: any;
  onAccountUpdate: (updatedAccount: any) => void;
}

export function AccountSettingsModal({
  isOpen,
  onClose,
  account,
  onAccountUpdate,
}: AccountSettingsModalProps) {
  const notify = useNotify();
  const [verified, setVerified] = useState(account.verified);
  const [postingFrequency, setPostingFrequency] = useState(account.postingFrequency);
  const [politicalLean, setPoliticalLean] = useState(account.politicalLean);
  const [personality, setPersonality] = useState(account.personality);
  const [accountType, setAccountType] = useState(account.accountType);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line
    setMounted(true);
  }, []);

  // Lock scroll on body when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const updateAccountMutation = api.thinkpages.updateAccount.useMutation();

  useEffect(() => {
    if (account) {
      // oxlint-disable-next-line
      setVerified(account.verified);
      setPostingFrequency(account.postingFrequency);
      setPoliticalLean(account.politicalLean);
      setPersonality(account.personality);
      setAccountType(account.accountType);
    }
  }, [account]);

  const handleSave = async () => {
    try {
      const updatedAccount = await updateAccountMutation.mutateAsync({
        accountId: account.id,
        verified,
        postingFrequency,
        politicalLean,
        personality,
        accountType,
      });
      notify.success("Account updated successfully!");
      onAccountUpdate(updatedAccount);
      onClose();
    } catch (error: any) {
      notify.error(error.message || "Failed to update account");
    }
  };

  if (!mounted) return null;

  return createPortal(
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
            className="relative mx-2 flex max-h-[90vh] w-full max-w-[95vw] flex-col sm:mx-4 sm:max-w-md md:max-w-lg"
          >
            <div className="flex flex-col rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-primary)] shadow-2xl">
              <div className="flex items-center justify-between border-b border-[var(--color-border-primary)] px-4 py-3 sm:px-6 sm:py-4">
                <h3 className="text-base font-bold text-[var(--color-text-primary)] sm:text-lg">
                  Account Settings
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] sm:p-2"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-4 sm:space-y-6 sm:p-6">
                <div className="flex items-center justify-between">
                  <label htmlFor="verified-switch" className="flex items-center gap-2">
                    <span className="text-lg" title="Verified">
                      ✅
                    </span>
                    <span className="text-sm font-medium text-[var(--color-text-primary)] sm:text-base">
                      Verified
                    </span>
                  </label>
                  <Switch id="verified-switch" checked={verified} onCheckedChange={setVerified} />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-[var(--color-text-secondary)] sm:text-sm">
                    Posting Frequency
                  </label>
                  <select
                    value={postingFrequency}
                    onChange={(e) => setPostingFrequency(e.target.value as any)}
                    className="block w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-all duration-200 hover:border-[var(--color-border-secondary)] focus:border-[var(--color-input-focus)] focus:bg-[var(--color-bg-secondary)] focus:ring-1 focus:ring-[var(--color-input-focus)]/30 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <option
                      value="low"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Low
                    </option>
                    <option
                      value="moderate"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Moderate
                    </option>
                    <option
                      value="active"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Active
                    </option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-[var(--color-text-secondary)] sm:text-sm">
                    Political Lean
                  </label>
                  <select
                    value={politicalLean}
                    onChange={(e) => setPoliticalLean(e.target.value as any)}
                    className="block w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-all duration-200 hover:border-[var(--color-border-secondary)] focus:border-[var(--color-input-focus)] focus:bg-[var(--color-bg-secondary)] focus:ring-1 focus:ring-[var(--color-input-focus)]/30 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <option
                      value="left"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Left
                    </option>
                    <option
                      value="center"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Center
                    </option>
                    <option
                      value="right"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Right
                    </option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-[var(--color-text-secondary)] sm:text-sm">
                    Personality
                  </label>
                  <select
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value as any)}
                    className="block w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-all duration-200 hover:border-[var(--color-border-secondary)] focus:border-[var(--color-input-focus)] focus:bg-[var(--color-bg-secondary)] focus:ring-1 focus:ring-[var(--color-input-focus)]/30 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <option
                      value="serious"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Serious
                    </option>
                    <option
                      value="casual"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Casual
                    </option>
                    <option
                      value="satirical"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Satirical
                    </option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-[var(--color-text-secondary)] sm:text-sm">
                    Account Type (Category)
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="block w-full rounded-xl border border-[var(--color-border-primary)] bg-[var(--color-bg-secondary)] px-3 py-2.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] transition-all duration-200 hover:border-[var(--color-border-secondary)] focus:border-[var(--color-input-focus)] focus:bg-[var(--color-bg-secondary)] focus:ring-1 focus:ring-[var(--color-input-focus)]/30 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <option
                      value="government"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Government
                    </option>
                    <option
                      value="media"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Media
                    </option>
                    <option
                      value="citizen"
                      className="bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
                    >
                      Citizen
                    </option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end border-t border-[var(--color-border-primary)] px-4 py-3 sm:px-6 sm:py-4">
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button variant="outline" onClick={onClose} className="text-xs sm:text-sm">
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={updateAccountMutation.isPending}
                    className="text-xs sm:text-sm"
                  >
                    {updateAccountMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
