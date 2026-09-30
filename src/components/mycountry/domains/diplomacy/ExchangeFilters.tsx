"use client";

import { Clock, Palette } from "iconoir-react";

import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Filter by exchange type">
            <Palette className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(exchangeTypes).map(([type, config]) => (
              <SelectItem key={type} value={type}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Filter by status">
            <Clock className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(statusStyles).map(([status, config]) => (
              <SelectItem key={status} value={status}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
);

ExchangeFilters.displayName = "ExchangeFilters";
