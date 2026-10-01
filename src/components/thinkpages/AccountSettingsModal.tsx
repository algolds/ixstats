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
import { SegmentedControl } from "~/components/ui/segmented-control";
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
            <span id="tp-posting-frequency" className="text-subhead text-label mb-2 block">
              Posting Frequency
            </span>
            <SegmentedControl
              aria-labelledby="tp-posting-frequency"
              fullWidth
              value={postingFrequency}
              onValueChange={setPostingFrequency}
              options={[
                { value: "low", label: "Low" },
                { value: "moderate", label: "Moderate" },
                { value: "active", label: "Active" },
              ]}
            />
          </div>
          <div>
            <span id="tp-political-lean" className="text-subhead text-label mb-2 block">
              Political Lean
            </span>
            <SegmentedControl
              aria-labelledby="tp-political-lean"
              fullWidth
              value={politicalLean}
              onValueChange={setPoliticalLean}
              options={[
                { value: "left", label: "Left" },
                { value: "center", label: "Center" },
                { value: "right", label: "Right" },
              ]}
            />
          </div>
          <div>
            <span id="tp-personality" className="text-subhead text-label mb-2 block">
              Personality
            </span>
            <SegmentedControl
              aria-labelledby="tp-personality"
              fullWidth
              value={personality}
              onValueChange={setPersonality}
              options={[
                { value: "serious", label: "Serious" },
                { value: "casual", label: "Casual" },
                { value: "satirical", label: "Satirical" },
              ]}
            />
          </div>
          <div>
            <span id="tp-account-type" className="text-subhead text-label mb-2 block">
              Account Type (Category)
            </span>
            <SegmentedControl
              aria-labelledby="tp-account-type"
              fullWidth
              value={accountType}
              onValueChange={setAccountType}
              options={[
                { value: "government", label: "Government" },
                { value: "media", label: "Media" },
                { value: "citizen", label: "Citizen" },
              ]}
            />
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
