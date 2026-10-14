"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Textarea } from "~/components/ui/textarea";
import {
  CompanySelect,
  Field,
  SectorSelect,
  formatSovereigns,
  parseAmount,
  useRequestId,
  type Sector,
} from "./shared";

interface ContractFormProps {
  companies: ReadonlyArray<{ id: string; name: string; capital: number }>;
  /** Nations the viewer owns: they can post government tenders funded from their wallet. */
  nations: ReadonlyArray<{ id: string; name: string }>;
  walletBalance: number;
  onDone: () => void;
}

type IssuerKind = "company" | "nation";

/**
 * Post a contract. From a company (B2B), its value moves from the company's capital into
 * escrow; from a nation (a government tender, B2G), from the owner's wallet.
 */
export function ContractForm({ companies, nations, walletBalance, onDone }: ContractFormProps) {
  const notify = useNotify();
  const [kind, setKind] = useState<IssuerKind>(companies.length > 0 ? "company" : "nation");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [countryId, setCountryId] = useState(nations[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState<Sector>("services");
  const [rawValue, setRawValue] = useState("");
  const [rawDays, setRawDays] = useState("7");
  const [requestId, rotate] = useRequestId();
  const value = parseAmount(rawValue);
  const days = parseAmount(rawDays);
  const company = companies.find((c) => c.id === companyId);

  const handlers = {
    onSuccess: () => {
      notify.success("Contract posted", "Bids are open");
      setTitle("");
      setDescription("");
      setRawValue("");
      rotate();
      onDone();
    },
    onError: (e: { message: string }) => notify.error("Could not post the contract", e.message),
  };
  const create = api.exchange.createContract.useMutation(handlers);
  const tender = api.exchange.createTender.useMutation(handlers);
  const pending = create.isPending || tender.isPending;

  const issuerChosen = kind === "company" ? !!companyId : !!countryId;
  const valid = issuerChosen && title.trim().length >= 3 && value >= 10 && days >= 1 && days <= 30;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const terms = {
          title,
          description: description || undefined,
          sectorKey: sector,
          value,
          biddingDays: days,
          requestId,
        };
        if (kind === "company") create.mutate({ issuerCompanyId: companyId, ...terms });
        else tender.mutate({ countryId, ...terms });
      }}
    >
      {companies.length > 0 && nations.length > 0 && (
        <SegmentedControl
          aria-label="Issued by"
          size="sm"
          value={kind}
          onValueChange={(v) => setKind(v as IssuerKind)}
          options={[
            { value: "company", label: "A company" },
            { value: "nation", label: "My nation (tender)" },
          ]}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {kind === "company" ? (
          <Field id="exchange-contract-company" label="Issuing company">
            <CompanySelect
              id="exchange-contract-company"
              companies={companies}
              value={companyId}
              onChange={setCompanyId}
            />
          </Field>
        ) : (
          <Field id="exchange-contract-nation" label="Issuing nation">
            <CompanySelect
              id="exchange-contract-nation"
              companies={nations}
              value={countryId}
              onChange={setCountryId}
            />
          </Field>
        )}
        <Field id="exchange-contract-sector" label="Sector">
          <SectorSelect id="exchange-contract-sector" value={sector} onChange={setSector} />
        </Field>
      </div>
      <Field id="exchange-contract-title" label="Title">
        <Input
          id="exchange-contract-title"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Supply 40 tonnes of grain to the capital"
        />
      </Field>
      <Field id="exchange-contract-description" label="Terms">
        <Textarea
          id="exchange-contract-description"
          value={description}
          maxLength={2000}
          rows={3}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What counts as delivered, and by when"
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="exchange-contract-value" label="Value (₷)">
          <Input
            id="exchange-contract-value"
            inputMode="numeric"
            value={rawValue}
            onChange={(e) => setRawValue(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="500"
          />
        </Field>
        <Field id="exchange-contract-days" label="Bids open for (days)">
          <Input
            id="exchange-contract-days"
            inputMode="numeric"
            value={rawDays}
            onChange={(e) => setRawDays(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={!valid || pending}>
          {pending ? "Posting..." : kind === "company" ? "Post contract" : "Post tender"}
        </Button>
        {kind === "company" && company && (
          <span className="text-caption text-label-secondary">
            {company.name} holds {formatSovereigns(company.capital)}
          </span>
        )}
        {kind === "nation" && (
          <span className="text-caption text-label-secondary">
            Escrow comes from your wallet ({formatSovereigns(walletBalance)})
          </span>
        )}
      </div>
    </form>
  );
}
