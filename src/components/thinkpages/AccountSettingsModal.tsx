"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2 } from "lucide-react";
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

  const updateAccountMutation = api.thinkpages.updateAccount.useMutation();

  useEffect(() => {
    if (account) {
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

  if (!isOpen) return null;

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
            className="relative mx-2 flex max-h-[90vh] w-full max-w-[95vw] flex-col sm:mx-4 sm:max-w-md md:max-w-lg"
          >
            <div className="flex flex-col rounded-xl border border-white/10 bg-neutral-900/50 shadow-lg backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
                <h3 className="text-base font-bold text-white sm:text-lg">Account Settings</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-white/10 sm:p-2"
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
                    <span className="text-sm font-medium text-white sm:text-base">Verified</span>
                  </label>
                  <Switch id="verified-switch" checked={verified} onCheckedChange={setVerified} />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-neutral-300 sm:text-sm">
                    Posting Frequency
                  </label>
                  <select
                    value={postingFrequency}
                    onChange={(e) => setPostingFrequency(e.target.value as any)}
                    className="block w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-3 py-2 text-xs text-white focus:border-blue-500 focus:ring-blue-500 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="active">Active</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-neutral-300 sm:text-sm">
                    Political Lean
                  </label>
                  <select
                    value={politicalLean}
                    onChange={(e) => setPoliticalLean(e.target.value as any)}
                    className="block w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-3 py-2 text-xs text-white focus:border-blue-500 focus:ring-blue-500 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-neutral-300 sm:text-sm">
                    Personality
                  </label>
                  <select
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value as any)}
                    className="block w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-3 py-2 text-xs text-white focus:border-blue-500 focus:ring-blue-500 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <option value="serious">Serious</option>
                    <option value="casual">Casual</option>
                    <option value="satirical">Satirical</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-medium text-neutral-300 sm:text-sm">
                    Account Type (Category)
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as any)}
                    className="block w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-3 py-2 text-xs text-white focus:border-blue-500 focus:ring-blue-500 sm:px-4 sm:py-3 sm:text-sm"
                  >
                    <option value="government">Government</option>
                    <option value="media">Media</option>
                    <option value="citizen">Citizen</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end border-t border-white/10 px-4 py-3 sm:px-6 sm:py-4">
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
    </AnimatePresence>
  );
}
