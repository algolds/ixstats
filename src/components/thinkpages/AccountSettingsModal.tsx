"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { X, Loader2, Check, Verified } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Switch } from '~/components/ui/switch';
import { api } from '~/trpc/react';
import { toast } from 'sonner';

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
        userId: account.id,
        verified,
        postingFrequency,
        politicalLean,
        personality,
      });
      toast.success('Account updated successfully!');
      onAccountUpdate(updatedAccount);
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update account');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center hs-overlay-backdrop-open:bg-black/50">
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
            className="relative w-full max-w-lg mx-4 max-h-[90vh] flex flex-col"
          >
            <div className="bg-neutral-900/50 border border-white/10 rounded-xl shadow-lg backdrop-blur-xl flex flex-col">
              <div className="py-4 px-6 flex justify-between items-center border-b border-white/10">
                <h3 className="font-bold text-white text-lg">Account Settings</h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-full text-neutral-400 hover:bg-white/10 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <label htmlFor="verified-switch" className="flex items-center gap-2">
                    <Verified className="h-5 w-5 text-blue-500" />
                    <span className="font-medium text-white">Verified</span>
                  </label>
                  <Switch
                    id="verified-switch"
                    checked={verified}
                    onCheckedChange={setVerified}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Posting Frequency</label>
                  <select
                    value={postingFrequency}
                    onChange={(e) => setPostingFrequency(e.target.value as any)}
                    className="py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="active">Active</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Political Lean</label>
                  <select
                    value={politicalLean}
                    onChange={(e) => setPoliticalLean(e.target.value as any)}
                    className="py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-neutral-300">Personality</label>
                  <select
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value as any)}
                    className="py-3 px-4 block w-full bg-neutral-800/50 border-neutral-700 rounded-lg text-sm text-white focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="serious">Serious</option>
                    <option value="casual">Casual</option>
                    <option value="satirical">Satirical</option>
                  </select>
                </div>
              </div>
              <div className="py-4 px-6 flex justify-end items-center border-t border-white/10">
                <div className="flex gap-x-2">
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                  <Button onClick={handleSave} disabled={updateAccountMutation.isPending}>
                    {updateAccountMutation.isPending && <Loader2 className="animate-spin h-4 w-4 mr-2" />}Save
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
