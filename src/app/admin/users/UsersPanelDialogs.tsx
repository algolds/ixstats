"use client";
// The link and assign dialogs of UsersPanel.tsx (presentational; the panel owns state and mutations).

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ValueSelect } from "~/components/ui/value-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";

const INPUT_CLASS = "rounded-control-sm md:text-footnote h-(--control-height-sm)";

interface DialogBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
  pending: boolean;
}

export function LinkWikiDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
  username,
  onUsernameChange,
}: DialogBaseProps & { username: string; onUsernameChange: (value: string) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link MediaWiki Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-label-secondary text-footnote">
            Enter the canonical MediaWiki username or known alt (e.g. <code>Kir</code>,{" "}
            <code>Carthinova</code>, <code>Urcea</code>).
          </p>
          <Input
            placeholder="MediaWiki Username..."
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={pending}>
            Save link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LinkDiscordDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
  username,
  onUsernameChange,
  discordUserId,
  onDiscordUserIdChange,
}: DialogBaseProps & {
  username: string;
  onUsernameChange: (value: string) => void;
  discordUserId: string;
  onDiscordUserIdChange: (value: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Discord identity</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-label-secondary text-footnote">
            Enter the Discord username and numeric snowflake ID.
          </p>
          <Input
            placeholder="Discord Username (e.g. username)..."
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            className={INPUT_CLASS}
          />
          <Input
            placeholder="Discord Snowflake User ID (e.g. 123456789012345678)..."
            value={discordUserId}
            onChange={(e) => onDiscordUserIdChange(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={pending}>
            Save Discord link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AssignCountryDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
  userOptions,
  selectedUser,
  onSelectedUserChange,
  countryOptions,
  selectedCountry,
  onSelectedCountryChange,
}: DialogBaseProps & {
  userOptions: ReadonlyArray<readonly [string, string]>;
  selectedUser: string;
  onSelectedUserChange: (value: string) => void;
  countryOptions: ReadonlyArray<readonly [string, string]>;
  selectedCountry: string;
  onSelectedCountryChange: (value: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign country to user</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <ValueSelect
            value={selectedUser}
            onValueChange={onSelectedUserChange}
            options={userOptions}
            size="sm"
            placeholder="Select a user..."
            itemClassName="text-footnote"
          />
          <ValueSelect
            value={selectedCountry}
            onValueChange={onSelectedCountryChange}
            options={countryOptions}
            size="sm"
            placeholder="Select a nation..."
            itemClassName="text-footnote"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={onSubmit} disabled={pending}>
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
