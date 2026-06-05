"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { EnhancedAccountManager } from "./EnhancedAccountManager";

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  accounts: any[];
  selectedAccount: any | null;
  onAccountSelect: (account: any) => void;
  onAccountSettings: (account: any) => void;
  onCreateAccount: () => void;
  isOwner: boolean;
}

export function AccountManagerModal({
  isOpen,
  onClose,
  countryId,
  accounts,
  selectedAccount,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  isOwner,
}: AccountManagerModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="glass-hierarchy-modal flex max-h-[90vh] max-w-lg flex-col overflow-hidden p-0"
        data-dialog-nested="true"
      >
        <DialogHeader className="border-border/40 shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-semibold">Account Manager</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <EnhancedAccountManager
            inModal={true}
            countryId={countryId}
            accounts={accounts}
            selectedAccount={selectedAccount}
            onAccountSelect={(account) => {
              onAccountSelect(account);
              onClose();
            }}
            onAccountSettings={(account) => {
              onAccountSettings(account);
              onClose();
            }}
            onCreateAccount={() => {
              onCreateAccount();
              onClose();
            }}
            isOwner={isOwner}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
