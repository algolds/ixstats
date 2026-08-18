"use client";

import React from "react";
import { RiPaletteLine, RiTimeLine } from "react-icons/ri";
import type {
  ExchangeType,
  ExchangeStatus,
  ExchangeTypeConfig,
  StatusConfig,
} from "./cultural-exchange-types";

interface ExchangeFiltersProps {
  filterType: string;
  setFilterType: (type: string) => void;
  filterStatus: string;
  setFilterStatus: (status: string) => void;
  exchangeTypes: Record<ExchangeType, ExchangeTypeConfig>;
  statusStyles: Record<ExchangeStatus, StatusConfig>;
}

export const ExchangeFilters = React.memo<ExchangeFiltersProps>(
  ({ filterType, setFilterType, filterStatus, setFilterStatus, exchangeTypes, statusStyles }) => {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-[--intel-gold]/20 bg-white/5 p-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <RiPaletteLine className="h-4 w-4 text-[--intel-silver]" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="text-foreground rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm focus:border-[--intel-gold]/50 focus:outline-none dark:border-white/30 dark:bg-black/20"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
              backgroundSize: "16px",
              appearance: "none",
              paddingRight: "32px",
            }}
          >
            <option value="all" className="bg-background text-foreground">
              All Types
            </option>
            {Object.entries(exchangeTypes).map(([type, config]) => (
              <option key={type} value={type} className="bg-background text-foreground">
                {config.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <RiTimeLine className="h-4 w-4 text-[--intel-silver]" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-foreground rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm focus:border-[--intel-gold]/50 focus:outline-none dark:border-white/30 dark:bg-black/20"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 8px center",
              backgroundSize: "16px",
              appearance: "none",
              paddingRight: "32px",
            }}
          >
            <option value="all" className="bg-background text-foreground">
              All Status
            </option>
            {Object.entries(statusStyles).map(([status, config]) => (
              <option key={status} value={status} className="bg-background text-foreground">
                {config.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  }
);

ExchangeFilters.displayName = "ExchangeFilters";
