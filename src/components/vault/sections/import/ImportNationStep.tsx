"use client";

import React, { useId } from "react";
import { Globe, ArrowRight } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { proxyNSImage } from "~/lib/cards/ns-image-proxy";

interface ImportNationStepProps {
  nationName: string;
  setNationName: (name: string) => void;
  onRequestVerification: (nationName: string) => void;
  isPending: boolean;
}

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Enter nation",
    desc: "Provide your NationStates nation name.",
  },
  {
    step: "2",
    title: "Open verification link",
    desc: "Visit the official NationStates verification page.",
  },
  {
    step: "3",
    title: "Paste code",
    desc: "Copy the checksum NationStates gives you into IxVault.",
  },
  {
    step: "4",
    title: "Mint deck",
    desc: "Your NationStates trading cards are imported.",
  },
] as const;

export function ImportNationStep({
  nationName,
  setNationName,
  onRequestVerification,
  isPending,
}: ImportNationStepProps) {
  const inputId = useId();

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-label text-title-3">Connect your NationStates nation</h2>
        <p className="text-label-secondary text-body">
          Verify ownership of a NationStates nation and bring its trading card deck into your Vault.
        </p>
      </div>

      {/* Compact framed NationStates badge (Well) */}
      <div
        data-slot="ns-compact-badge"
        className="rounded-row border-separator bg-surface-secondary flex flex-wrap items-center gap-3 border px-3 py-2"
      >
        <img
          src={proxyNSImage("https://www.nationstates.net/images/bannertitle.png")}
          alt="NationStates"
          className="h-6 w-auto shrink-0 object-contain"
        />
        <p className="text-footnote text-label-secondary min-w-0 flex-1 leading-snug">
          Read-only verification via the{" "}
          <a
            href="https://www.nationstates.net/page=api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-tint underline-offset-4 hover:underline"
          >
            NationStates API
          </a>
          . Your NationStates password is never requested.
        </p>
      </div>

      {/* Immediate nation-name input with zero extra click gate */}
      <Card variant="well" padding="md" className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor={inputId}>NationStates nation name</Label>
          <div className="relative">
            <Globe
              aria-hidden
              className="text-label-secondary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <Input
              id={inputId}
              value={nationName}
              onChange={(e) => setNationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nationName.trim()) {
                  onRequestVerification(nationName.trim());
                }
              }}
              placeholder="e.g. Testlandia"
              className="pl-9"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={() => onRequestVerification(nationName.trim())}
          disabled={!nationName.trim() || isPending}
          className="w-full"
        >
          {isPending ? (
            "Starting verification..."
          ) : (
            <>
              Start verification
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        {HOW_IT_WORKS.map((item) => (
          <Card key={item.step} variant="well" padding="sm" className="flex items-start gap-3">
            <div className="bg-tint-fill text-tint-ink rounded-control-sm text-footnote flex size-7 shrink-0 items-center justify-center font-semibold tabular-nums">
              {item.step}
            </div>
            <div className="min-w-0">
              <p className="text-label text-subhead">{item.title}</p>
              <p className="text-label-secondary text-footnote">{item.desc}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
