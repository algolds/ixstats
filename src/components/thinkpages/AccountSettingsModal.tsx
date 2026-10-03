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
import { PersonaTraitControls, type PersonaTraitKey } from "./account/PersonaTraitControls";

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: any;
  onAccountUpdate: (updatedAccount: any) => void;
}

const SETTING_KEYS = ["postingFrequency", "politicalLean", "personality", "accountType"] as const;

// Values come straight from the account row, so they keep the mutation's enum typing
const pickSettings = (account: any): Record<(typeof SETTING_KEYS)[number], any> =>
  Object.fromEntries(SETTING_KEYS.map((key) => [key, account[key]]));

export function AccountSettingsModal({
  isOpen,
  onClose,
  account,
  onAccountUpdate,
}: AccountSettingsModalProps) {
  const notify = useNotify();
  const [settings, setSettings] = useState(() => pickSettings(account));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // oxlint-disable-next-line
    setMounted(true);
  }, []);

  const updateAccountMutation = api.thinkpages.updateAccount.useMutation();

  useEffect(() => {
    if (account) {
      // oxlint-disable-next-line
      setSettings(pickSettings(account));
    }
  }, [account]);

  const handleSave = async () => {
    try {
      const updatedAccount = await updateAccountMutation.mutateAsync({
        accountId: account.id,
        ...settings,
      });
      notify.success("Account updated");
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
          <DialogTitle className="text-title-3">Account settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <PersonaTraitControls
            idPrefix="tp"
            values={settings}
            onChange={(key: PersonaTraitKey, value) =>
              setSettings((prev) => ({ ...prev, [key]: value }))
            }
          />
          <div>
            <span id="tp-account-type" className="text-subhead text-label mb-2 block">
              Account Type (Category)
            </span>
            <SegmentedControl
              aria-labelledby="tp-account-type"
              fullWidth
              value={settings.accountType}
              onValueChange={(accountType) => setSettings((prev) => ({ ...prev, accountType }))}
              options={[
                { value: "government", label: "Government" },
                { value: "media", label: "Media" },
                { value: "citizen", label: "Citizen" },
              ]}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
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
