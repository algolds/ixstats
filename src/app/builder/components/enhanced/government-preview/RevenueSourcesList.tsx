"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Progress } from '~/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { Receipt, ChevronDown, ChevronRight } from 'lucide-react';
import type { RevenueSource } from '~/types/government';
import { formatCurrency } from '~/lib/format-utils';

interface RevenueSourcesListProps {
  sources: RevenueSource[];
  totalRevenue: number;
  currency: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  openRevenues: Record<string, boolean>;
  onToggleRevenue: (id: string) => void;
}

export function RevenueSourcesList({
  sources,
  totalRevenue,
  currency,
  isOpen,
  onOpenChange,
  openRevenues,
  onToggleRevenue,
}: RevenueSourcesListProps) {
  if (sources.length === 0) return null;

  const formatCurrencyLocal = (amount: number) => formatCurrency(amount, currency);

  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Revenue Sources
                <Badge variant="secondary" className="ml-2">
                  {sources.length}
                </Badge>
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform" />
              )}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-2">
              {sources
                .sort((a, b) => b.revenueAmount - a.revenueAmount)
                .map((source) => {
                  const percentage = (source.revenueAmount / totalRevenue) * 100;
                  const isRevOpen = openRevenues[source.id] || false;

                  return (
                    <Collapsible
                      key={source.id}
                      open={isRevOpen}
                      onOpenChange={() => onToggleRevenue(source.id)}
                    >
                      <div className="border rounded-lg overflow-hidden">
                        <CollapsibleTrigger asChild>
                          <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{source.name}</span>
                              {isRevOpen ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="text-right">
                              <span className="font-semibold">{formatCurrencyLocal(source.revenueAmount)}</span>
                              <span className="text-sm text-muted-foreground ml-2">({percentage.toFixed(1)}%)</span>
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 border-t bg-muted/20">
                            <div className="pt-3 space-y-2">
                              {source.description && (
                                <p className="text-sm text-muted-foreground">{source.description}</p>
                              )}
                              <Progress value={percentage} className="h-2" />
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Source ID:</span>
                                  <p className="font-medium text-xs truncate">{source.id}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Percentage:</span>
                                  <p className="font-medium">{percentage.toFixed(2)}%</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Revenue Amount:</span>
                                  <p className="font-medium">{formatCurrencyLocal(source.revenueAmount)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Source Type:</span>
                                  <p className="font-medium capitalize">{source.name.split(' ')[0]}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  );
                })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
