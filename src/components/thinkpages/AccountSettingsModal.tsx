"use client";

import React, { useState, useEffect } from "react";
import { SystemRestart as Loader2 } from "iconoir-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { fieldStyles } from "~/components/ui/input";
import { cn } from "~/lib/utils";

const SELECT_CLASS = cn(
  fieldStyles,
  "rounded-control text-body block h-(--control-height) w-full px-3"
);
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] sm:max-w-md md:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="text-title-3">Account Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label htmlFor="tp-posting-frequency" className="text-subhead text-label mb-2 block">
              Posting Frequency
            </label>
            <select
              id="tp-posting-frequency"
              value={postingFrequency}
              onChange={(e) => setPostingFrequency(e.target.value as any)}
              className={SELECT_CLASS}
            >
              <option value="low">Low</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
            </select>
          </div>
          <div>
            <label htmlFor="tp-political-lean" className="text-subhead text-label mb-2 block">
              Political Lean
            </label>
            <select
              id="tp-political-lean"
              value={politicalLean}
              onChange={(e) => setPoliticalLean(e.target.value as any)}
              className={SELECT_CLASS}
            >
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>
          <div>
            <label htmlFor="tp-personality" className="text-subhead text-label mb-2 block">
              Personality
            </label>
            <select
              id="tp-personality"
              value={personality}
              onChange={(e) => setPersonality(e.target.value as any)}
              className={SELECT_CLASS}
            >
              <option value="serious">Serious</option>
              <option value="casual">Casual</option>
              <option value="satirical">Satirical</option>
            </select>
          </div>
          <div>
            <label htmlFor="tp-account-type" className="text-subhead text-label mb-2 block">
              Account Type (Category)
            </label>
            <select
              id="tp-account-type"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as any)}
              className={SELECT_CLASS}
            >
              <option value="government">Government</option>
              <option value="media">Media</option>
              <option value="citizen">Citizen</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateAccountMutation.isPending}>
            {updateAccountMutation.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
