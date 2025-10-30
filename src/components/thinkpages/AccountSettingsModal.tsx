"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { X, Loader2, Check, Verified } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { api } from "~/trpc/react";
import { toast } from "sonner";

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
  const [verified, setVerified] = useState(account.verified);
  const [postingFrequency, setPostingFrequency] = useState(account.postingFrequency);
  const [politicalLean, setPoliticalLean] = useState(account.politicalLean);
  const [personality, setPersonality] = useState(account.personality);

  const updateAccountMutation = api.thinkpages.updateAccount.useMutation();

  useEffect(() => {
    if (account) {
      setVerified(account.verified);
      setPostingFrequency(account.postingFrequency);
      setPoliticalLean(account.politicalLean);
      setPersonality(account.personality);
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
      });
      toast.success("Account updated successfully!");
      onAccountUpdate(updatedAccount);
      onClose();
    } catch (error: any) {
      toast.error(error.message || "Failed to update account");
    }
  };

  if (!isOpen) return null;

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
            className="relative mx-4 flex max-h-[90vh] w-full max-w-lg flex-col"
          >
            <div className="flex flex-col rounded-xl border border-white/10 bg-neutral-900/50 shadow-lg backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <h3 className="text-lg font-bold text-white">Account Settings</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-6 p-6">
                <div className="flex items-center justify-between">
                  <label htmlFor="verified-switch" className="flex items-center gap-2">
                    <Verified className="h-5 w-5 text-blue-500" />
                    <span className="font-medium text-white">Verified</span>
                  </label>
                  <Switch id="verified-switch" checked={verified} onCheckedChange={setVerified} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Posting Frequency
                  </label>
                  <select
                    value={postingFrequency}
                    onChange={(e) => setPostingFrequency(e.target.value as any)}
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
                    value={politicalLean}
                    onChange={(e) => setPoliticalLean(e.target.value as any)}
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
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value as any)}
                    className="block w-full rounded-lg border-neutral-700 bg-neutral-800/50 px-4 py-3 text-sm text-white focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="serious">Serious</option>
                    <option value="casual">Casual</option>
                    <option value="satirical">Satirical</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end border-t border-white/10 px-6 py-4">
                <div className="flex gap-x-2">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={updateAccountMutation.isPending}>
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
