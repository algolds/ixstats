"use client";

import React from "react";
import {
  OpenNewWindow as ExternalLink,
  ShieldCheck,
  ArrowLeft,
  SystemRestart as Loader2,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { FacetCard } from "~/components/ui/facet-container";

export interface ImportVerifyStepProps {
  nationName: string;
  verificationUrl: string;
  checksum: string;
  setChecksum: (checksum: string) => void;
  onVerify: () => void;
  onBack: () => void;
  isPending: boolean;
}

export function ImportVerifyStep({
  nationName,
  verificationUrl,
  checksum,
  setChecksum,
  onVerify,
  onBack,
  isPending,
}: ImportVerifyStepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-label text-title-2">Verify Ownership</h2>
        <p className="text-label-secondary text-body mt-1">
          Prove you own <span className="text-yellow font-semibold">{nationName}</span> via
          NationStates login verification
        </p>
      </div>

      {/* Instructions */}
      <FacetCard className="rounded-row space-y-3 p-5">
        <h4 className="text-label text-headline">Instructions</h4>
        <ol className="text-label-secondary text-body list-inside space-y-2">
          <li className="flex items-start gap-2">
            <span className="bg-fill-3 text-label text-footnote flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-semibold">
              1
            </span>
            <span>
              Click the link below to open NationStates verification.{" "}
              <strong className="text-label">Log in if prompted.</strong>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-fill-3 text-label text-footnote flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-semibold">
              2
            </span>
            NationStates will display a verification code
          </li>
          <li className="flex items-start gap-2">
            <span className="bg-fill-3 text-label text-footnote flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-semibold">
              3
            </span>
            Copy that code and paste it in the field below
          </li>
        </ol>
      </FacetCard>

      {/* NS verification link */}
      {verificationUrl && (
        <a
          href={verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-row border-blue/30 bg-blue/10 text-headline text-blue hover:bg-blue/20 flex items-center justify-center gap-2 border px-5 py-4 transition-colors active:scale-[0.98]"
        >
          <ExternalLink className="h-4 w-4" />
          Open NationStates Verification Page
        </a>
      )}

      {/* Code input */}
      <FacetCard className="rounded-row border-tint/30 bg-tint-fill space-y-2 border p-5">
        <label className="text-eyebrow text-yellow">
          Paste Verification Code from NationStates
        </label>
        <Input
          value={checksum}
          onChange={(e) => setChecksum(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && checksum.trim()) {
              onVerify();
            }
          }}
          placeholder="Paste the code NationStates gave you..."
          className="bg-background text-body h-12 font-mono"
        />
      </FacetCard>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button onClick={onVerify} disabled={!checksum.trim() || isPending} className="flex-1">
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="mr-2 h-4 w-4" />
          )}
          Verify Ownership
        </Button>
      </div>
    </div>
  );
}
