"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { EnhancedAccountManager } from "./EnhancedAccountManager";

interface AccountManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: any[];
  selectedAccount: any | null;
  onAccountSelect: (account: any) => void;
  onAccountSettings: (account: any) => void;
  onCreateAccount: () => void;
  isOwner: boolean;
  /** Opens the Dashboard's Accounts section; without it there is no Manage accounts link. */
  onManageAccounts?: () => void;
}

export function AccountManagerModal({
  isOpen,
  onClose,
  accounts,
  selectedAccount,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  isOwner,
  onManageAccounts,
}: AccountManagerModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="flex max-h-[90vh] max-w-lg flex-col overflow-hidden p-0"
        data-dialog-nested="true"
      >
        <DialogHeader className="border-separator shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle className="text-title-3">Account manager</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-x-hidden overflow-y-auto p-6">
          <EnhancedAccountManager
            inModal={true}
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
        {onManageAccounts && (
          <div className="border-separator shrink-0 border-t px-6 py-3">
            <Button
              variant="link"
              size="sm"
              type="button"
              onClick={() => {
                onClose();
                onManageAccounts();
              }}
            >
              Manage accounts
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
