"use client";

import {
  ArrowLeft,
  Check,
  WarningCircle as AlertCircle,
  SystemRestart as Loader2,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

interface AccountDetailsFormProps {
  formData: {
    firstName: string;
    lastName: string;
    username: string;
    bio: string;
    postingFrequency: "active" | "moderate" | "low";
    politicalLean: "left" | "center" | "right";
    personality: "serious" | "casual" | "satirical";
    profileImageUrl?: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  errors: Record<string, string>;
  isCheckingUsername: boolean;
  isUsernameAvailable: boolean | null;
  isValidUsernameFormat: boolean;
  handleUsernameChange: (username: string) => void;
  onBack: () => void;
  onOpenImageSearch: () => void;
  className?: string;
}

export function AccountDetailsForm({
  formData,
  setFormData,
  errors,
  isCheckingUsername,
  isUsernameAvailable,
  isValidUsernameFormat,
  handleUsernameChange,
  onBack,
  onOpenImageSearch,
  className,
}: AccountDetailsFormProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to account type">
          <ArrowLeft />
        </Button>
        <h3 className="text-headline text-label">Account details</h3>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="thinkpages-first-name" className="text-subhead text-label mb-2 block">
            First name
          </label>
          <Input
            id="thinkpages-first-name"
            type="text"
            value={formData.firstName}
            onChange={(e) => setFormData((p: any) => ({ ...p, firstName: e.target.value }))}
            placeholder="Enter first name"
            aria-invalid={!!errors.firstName || undefined}
          />
          {errors.firstName && (
            <p className="text-footnote text-destructive mt-1">{errors.firstName}</p>
          )}
        </div>

        <div>
          <label htmlFor="thinkpages-last-name" className="text-subhead text-label mb-2 block">
            Last Name (optional)
          </label>
          <Input
            id="thinkpages-last-name"
            type="text"
            value={formData.lastName}
            onChange={(e) => setFormData((p: any) => ({ ...p, lastName: e.target.value }))}
            placeholder="Enter last name"
          />
        </div>
      </div>

      {/* Username Handle */}
      <div>
        <label htmlFor="thinkpages-username" className="text-subhead text-label mb-2 block">
          Username handle
        </label>
        <div className="relative">
          <span className="text-body text-label-secondary absolute inset-y-0 left-3 flex items-center">
            @
          </span>
          <Input
            id="thinkpages-username"
            type="text"
            value={formData.username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            placeholder="username"
            aria-invalid={!!errors.username || undefined}
            className={cn("pr-10 pl-8", isUsernameAvailable && "border-success")}
          />
          <div className="absolute inset-y-0 right-3 flex items-center">
            {isCheckingUsername && (
              <Loader2 className="text-label-secondary size-4 animate-spin" aria-label="Checking" />
            )}
            {isUsernameAvailable === true && (
              <Check className="text-success size-4" aria-label="Available" />
            )}
            {isUsernameAvailable === false && !errors.username && (
              <AlertCircle className="text-destructive size-4" aria-label="Unavailable" />
            )}
          </div>
        </div>
        {errors.username ? (
          <p className="text-footnote text-destructive mt-1">{errors.username}</p>
        ) : isUsernameAvailable === true ? (
          <p className="text-footnote text-success mt-1">Username handle is available</p>
        ) : isUsernameAvailable === false && formData.username.length >= 3 ? (
          <p className="text-footnote text-destructive mt-1">
            {!isValidUsernameFormat
              ? "Must start with a letter (letters, numbers, underscores only)"
              : "Username is already taken"}
          </p>
        ) : (
          <p className="text-footnote text-label-secondary mt-1">
            3-20 characters, letters, numbers, and underscores
          </p>
        )}
      </div>

      {/* Bio */}
      <div>
        <label htmlFor="thinkpages-bio" className="text-subhead text-label mb-2 block">
          Bio (optional)
        </label>
        <Textarea
          id="thinkpages-bio"
          value={formData.bio}
          onChange={(e) => setFormData((p: any) => ({ ...p, bio: e.target.value }))}
          placeholder="Describe this account..."
          maxLength={160}
          className="min-h-[80px]"
        />
        <div className="text-footnote text-label-secondary mt-1 text-right tabular-nums">
          {formData.bio.length}/160
        </div>
      </div>

      {/* Profile Image Picker */}
      <div>
        <span className="text-subhead text-label mb-2 block">Profile Image (optional)</span>
        <div className="flex items-center gap-4">
          <div className="border-separator bg-fill-3 size-16 shrink-0 overflow-hidden rounded-full border">
            {formData.profileImageUrl ? (
              <img
                src={formData.profileImageUrl}
                alt="Profile"
                className="size-full object-cover"
              />
            ) : (
              <div className="text-footnote text-label-secondary flex size-full items-center justify-center">
                No image
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onOpenImageSearch}>
              Search repository
            </Button>
            {formData.profileImageUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFormData((p: any) => ({ ...p, profileImageUrl: "" }))}
                className="text-destructive hover:text-destructive"
              >
                Remove image
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
