"use client";

// src/components/admin/equipment/SmallArmsTab.tsx
// Small Arms tab: statistics cards and equipment availability summary.

import { Card } from "~/components/ui/card";
import { Filter } from "iconoir-react";

interface SmallArmsTabProps {
  smallArmsEquipment: any;
  smallArmsStats: any;
  smallArmsLoading: boolean;
}

export function SmallArmsTab({
  smallArmsEquipment,
  smallArmsStats,
  smallArmsLoading,
}: SmallArmsTabProps) {
  return (
    <div className="space-y-6">
      <div className="facet-card-parent rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-foreground text-xl font-bold">Small Arms Equipment</h2>
          <p className="text-muted-foreground text-sm">
            Manage small arms catalog and manufacturers
          </p>
        </div>
      </div>

      {smallArmsLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500"></div>
          <p className="text-muted-foreground">Loading small arms equipment...</p>
        </div>
      ) : (
        <>
          {/* Statistics */}
          {smallArmsStats && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card className="facet-card-child p-4">
                <p className="text-muted-foreground text-sm">Total Equipment</p>
                <p className="text-foreground mt-2 text-3xl font-bold">
                  {smallArmsStats.totalEquipment}
                </p>
              </Card>
              <Card className="facet-card-child p-4">
                <p className="text-muted-foreground text-sm">Equipment Types</p>
                <p className="mt-2 text-3xl font-bold text-blue-400">
                  {smallArmsStats.equipmentByType.length}
                </p>
              </Card>
              <Card className="facet-card-child p-4">
                <p className="text-muted-foreground text-sm">Manufacturers</p>
                <p className="mt-2 text-3xl font-bold text-green-400">
                  {smallArmsStats.totalManufacturers}
                </p>
              </Card>
              <Card className="facet-card-child p-4">
                <p className="text-muted-foreground text-sm">Eras</p>
                <p className="mt-2 text-3xl font-bold text-purple-400">
                  {smallArmsStats.equipmentByEra.length}
                </p>
              </Card>
            </div>
          )}

          {/* Equipment Display */}
          {smallArmsEquipment &&
          smallArmsEquipment.equipment &&
          smallArmsEquipment.equipment.length > 0 ? (
            <div className="facet-card-child rounded-xl border border-white/10 p-6">
              <p className="text-foreground text-sm">
                {smallArmsEquipment.equipment.length} equipment items available
              </p>
            </div>
          ) : (
            <Card className="facet-card-parent p-12 text-center">
              <Filter className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground">No small arms equipment found</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
