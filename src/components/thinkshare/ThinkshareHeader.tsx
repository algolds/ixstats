"use client";

import React from "react";
import { Send, Plus, User } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface Account {
  id: string;
  displayName: string;
  profileImageUrl?: string | null;
}

interface ThinkshareHeaderProps {
  onNewMessageClick: () => void;
  accounts: Account[];
  selectedAccount: string | null;
  onAccountChange: (accountId: string) => void;
}

export function ThinkshareHeader({
  onNewMessageClick,
  accounts,
  selectedAccount,
  onAccountChange,
}: ThinkshareHeaderProps) {
  return (
    <Card className="glass-hierarchy-parent relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-green-600/10 via-transparent to-emerald-600/10" />
      <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-green-500 via-emerald-500 to-green-500" />
      <CardContent className="relative p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-green-600 to-emerald-700 shadow-lg">
                <Send className="h-6 w-6 text-white" />
              </div>
              <div className="border-background absolute -top-1 -right-1 h-4 w-4 animate-pulse rounded-full border-2 bg-emerald-500" />
            </div>
            <div>
              <h2 className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-xl font-bold text-transparent">
                ThinkShare
              </h2>
              <p className="text-muted-foreground text-sm">
                Private messaging • Connect with minds worldwide
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Select onValueChange={onAccountChange} value={selectedAccount || undefined}>
              <SelectTrigger className="w-[200px]">
                <User className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Select Account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={onNewMessageClick}
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700"
              disabled={!selectedAccount}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Message
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
