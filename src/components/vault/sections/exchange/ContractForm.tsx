"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
  onDone: () => void;
}

/** Post a B2B contract; its value moves from the company's capital into escrow. */
export function ContractForm({ companies, onDone }: ContractFormProps) {
  const notify = useNotify();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sector, setSector] = useState<Sector>("services");
  const [rawValue, setRawValue] = useState("");
  const [rawDays, setRawDays] = useState("7");
  const [requestId, rotate] = useRequestId();
  const value = parseAmount(rawValue);
  const days = parseAmount(rawDays);
  const company = companies.find((c) => c.id === companyId);

  const create = api.exchange.createContract.useMutation({
    onSuccess: () => {
      notify.success("Contract posted", "Bids are open");
      setTitle("");
      setDescription("");
      setRawValue("");
      rotate();
      onDone();
    },
    onError: (e) => notify.error("Could not post the contract", e.message),
  });

  const valid = !!companyId && title.trim().length >= 3 && value >= 10 && days >= 1 && days <= 30;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        create.mutate({
          issuerCompanyId: companyId,
          title,
          description: description || undefined,
          sectorKey: sector,
          value,
          biddingDays: days,
          requestId,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="exchange-contract-company" label="Issuing company">
          <CompanySelect
            id="exchange-contract-company"
            companies={companies}
            value={companyId}
            onChange={setCompanyId}
          />
        </Field>
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
        <Button type="submit" size="sm" disabled={!valid || create.isPending}>
          {create.isPending ? "Posting..." : "Post contract"}
        </Button>
        {company && (
          <span className="text-caption text-label-secondary">
            {company.name} holds {formatSovereigns(company.capital)}
          </span>
        )}
      </div>
    </form>
  );
}
