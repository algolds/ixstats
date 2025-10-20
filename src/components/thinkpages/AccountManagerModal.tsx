"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { EnhancedAccountManager } from './EnhancedAccountManager';

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
  isOwner
}: AccountManagerModalProps) {
  console.log('AccountManagerModal render - isOpen:', isOpen);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      console.log('Dialog onOpenChange called with:', open);
      if (!open) onClose();
    }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Account Manager</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto">
          <EnhancedAccountManager
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
