"use client";

import React from "react";
import { ExternalLink, ShieldCheck, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

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
        <h2 className="text-foreground text-xl font-black">Verify Ownership</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Prove you own <span className="font-semibold text-rose-400">{nationName}</span> via NationStates login verification
        </p>
      </div>

      {/* Instructions */}
      <div className="glass-hierarchy-child border-border space-y-3 rounded-xl border p-5">
        <h4 className="text-foreground text-sm font-bold">Instructions</h4>
        <ol className="text-muted-foreground list-inside space-y-2.5 text-sm">
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
              1
            </span>
            <span>
              Click the link below to open NationStates verification.{" "}
              <strong className="text-foreground/80">Log in if prompted.</strong>
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
              2
            </span>
            NationStates will display a verification code
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold">
              3
            </span>
            Copy that code and paste it in the field below
          </li>
        </ol>
      </div>

      {/* NS verification link */}
      {verificationUrl && (
        <a
          href={verificationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/10 px-5 py-3.5 text-sm font-bold text-blue-400 transition-colors hover:bg-blue-500/20"
        >
          <ExternalLink className="h-4 w-4" />
          Open NationStates Verification Page
        </a>
      )}

      {/* Code input */}
      <div className="space-y-2 rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/5 to-orange-500/5 p-5">
        <label className="text-xs font-semibold tracking-wider text-amber-400/70 uppercase">
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
          className="glass-hierarchy-interactive h-12 font-mono text-base"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="border-white/10">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button
          onClick={onVerify}
          disabled={!checksum.trim() || isPending}
          className="flex-1 bg-gradient-to-r from-rose-500 to-orange-500 font-bold text-white shadow-lg shadow-rose-500/20 hover:from-rose-600 hover:to-orange-600"
        >
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
