"use client";

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '~/components/ui/dialog';
import { UnifiedComposerContainer } from './UnifiedComposerContainer';

interface RepostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalPost: any;
  countryId: string;
  selectedAccount: any;
  accounts: any[];
  onAccountSelect?: (account: any) => void;
  onAccountSettings?: (account: any) => void;
  onCreateAccount?: () => void;
  isOwner: boolean;
  onPost: () => void;
}

export function RepostModal({
  open,
  onOpenChange,
  originalPost,
  countryId,
  selectedAccount,
  accounts,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  isOwner,
  onPost
}: RepostModalProps) {
  const handlePost = () => {
    onPost();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-hierarchy-modal max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Repost</DialogTitle>
        </DialogHeader>
        <UnifiedComposerContainer
          countryId={countryId}
          selectedAccount={selectedAccount}
          accounts={accounts}
          onAccountSelect={onAccountSelect || (() => {})}
          onAccountSettings={onAccountSettings || (() => {})}
          onCreateAccount={onCreateAccount || (() => {})}
          isOwner={isOwner}
          onPost={handlePost}
          repostData={{
            originalPost,
            mode: 'repost'
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
