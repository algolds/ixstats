"use client";

import React, { useId } from "react";
import { OpenNewWindow as ExternalLink, ShieldCheck, ArrowLeft } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

interface ImportVerifyStepProps {
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
  const checksumId = useId();

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-label text-title-3">Verify ownership</h2>
        <p className="text-label-secondary text-body">
          Prove you control <span className="text-label font-medium">{nationName}</span> using
          NationStates login verification.
        </p>
      </div>

      <Card variant="well" padding="md" className="space-y-3">
        <h3 className="text-label text-subhead">Instructions</h3>
        <ol className="text-label-secondary text-footnote space-y-2">
          <li className="flex items-start gap-2.5">
            <span className="bg-fill-3 text-label text-caption flex size-5 shrink-0 items-center justify-center rounded-full font-medium tabular-nums">
              1
            </span>
            <span>
              Open the NationStates verification page below and{" "}
              <strong className="text-label font-medium">sign in if prompted</strong>.
            </span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="bg-fill-3 text-label text-caption flex size-5 shrink-0 items-center justify-center rounded-full font-medium tabular-nums">
              2
            </span>
            <span>Copy the verification code displayed by NationStates.</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="bg-fill-3 text-label text-caption flex size-5 shrink-0 items-center justify-center rounded-full font-medium tabular-nums">
              3
            </span>
            <span>Paste the code into the field below and confirm ownership.</span>
          </li>
        </ol>
      </Card>

      {verificationUrl && (
        <Button variant="secondary" asChild className="w-full">
          <a href={verificationUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="size-4" />
            Open NationStates verification page
          </a>
        </Button>
      )}

      <Card variant="well" padding="md" className="space-y-2">
        <Label htmlFor={checksumId}>Verification code from NationStates</Label>
        <Input
          id={checksumId}
          value={checksum}
          onChange={(e) => setChecksum(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && checksum.trim()) {
              onVerify();
            }
          }}
          placeholder="Paste the code NationStates gave you"
          className="font-data"
        />
      </Card>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={onVerify}
          disabled={!checksum.trim() || isPending}
          className="flex-1"
        >
          {isPending ? (
            "Verifying..."
          ) : (
            <>
              <ShieldCheck className="size-4" />
              Verify ownership
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
