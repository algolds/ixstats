"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Crown, User, Building2, Users } from 'lucide-react';
import type { GovernmentStructure } from '~/types/government';

interface StructureOverviewProps {
  structure: GovernmentStructure;
  getGovernmentTypeIcon: (type: string) => React.ReactNode;
}

export function StructureOverview({ structure, getGovernmentTypeIcon }: StructureOverviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5" />
          Government Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                {getGovernmentTypeIcon(structure.governmentType)}
                <span className="text-sm font-medium text-muted-foreground">Government Details</span>
              </div>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-muted-foreground">Name:</span>
                  <p className="font-semibold">{structure.governmentName}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Type:</span>
                  <p className="font-semibold">{structure.governmentType}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">Fiscal Year:</span>
                  <p className="font-semibold">{structure.fiscalYear}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Leadership */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4" />
                <span className="text-sm font-medium text-muted-foreground">Leadership</span>
              </div>
              <div className="space-y-2">
                {structure.headOfState && (
                  <div>
                    <span className="text-sm text-muted-foreground">Head of State:</span>
                    <p className="font-semibold">{structure.headOfState}</p>
                  </div>
                )}
                {structure.headOfGovernment && (
                  <div>
                    <span className="text-sm text-muted-foreground">Head of Government:</span>
                    <p className="font-semibold">{structure.headOfGovernment}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Branches of Government */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4" />
                <span className="text-sm font-medium text-muted-foreground">Branches</span>
              </div>
              <div className="space-y-2">
                {structure.legislatureName && (
                  <div>
                    <span className="text-sm text-muted-foreground">Legislature:</span>
                    <p className="font-semibold">{structure.legislatureName}</p>
                  </div>
                )}
                {structure.executiveName && (
                  <div>
                    <span className="text-sm text-muted-foreground">Executive:</span>
                    <p className="font-semibold">{structure.executiveName}</p>
                  </div>
                )}
                {structure.judicialName && (
                  <div>
                    <span className="text-sm text-muted-foreground">Judiciary:</span>
                    <p className="font-semibold">{structure.judicialName}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
