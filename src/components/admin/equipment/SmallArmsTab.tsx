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
      <div className="bg-surface rounded-row border-separator border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-label text-title-2">Small arms equipment</h2>
          <p className="text-label-secondary text-body">
            Manage small arms catalog and manufacturers
          </p>
        </div>
      </div>

      {smallArmsLoading ? (
        <div className="py-12 text-center">
          <div className="border-orange mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2"></div>
          <p className="text-label-secondary">Loading small arms equipment...</p>
        </div>
      ) : (
        <>
          {/* Statistics */}
          {smallArmsStats && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <Card className="flex flex-col gap-6 p-4 py-6">
                <p className="text-label-secondary text-body">Total equipment</p>
                <p className="text-label text-large-title mt-2">{smallArmsStats.totalEquipment}</p>
              </Card>
              <Card className="flex flex-col gap-6 p-4 py-6">
                <p className="text-label-secondary text-body">Equipment types</p>
                <p className="text-large-title text-blue mt-2">
                  {smallArmsStats.equipmentByType.length}
                </p>
              </Card>
              <Card className="flex flex-col gap-6 p-4 py-6">
                <p className="text-label-secondary text-body">Manufacturers</p>
                <p className="text-large-title text-green mt-2">
                  {smallArmsStats.totalManufacturers}
                </p>
              </Card>
              <Card className="flex flex-col gap-6 p-4 py-6">
                <p className="text-label-secondary text-body">Eras</p>
                <p className="text-large-title text-indigo mt-2">
                  {smallArmsStats.equipmentByEra.length}
                </p>
              </Card>
            </div>
          )}

          {/* Equipment Display */}
          {smallArmsEquipment &&
          smallArmsEquipment.equipment &&
          smallArmsEquipment.equipment.length > 0 ? (
            <div className="bg-surface rounded-row border-separator border p-6">
              <p className="text-label text-body">
                {smallArmsEquipment.equipment.length} equipment items available
              </p>
            </div>
          ) : (
            <Card className="flex flex-col gap-6 p-12 py-6 text-center">
              <Filter className="text-label-secondary mx-auto mb-4 h-12 w-12" />
              <p className="text-label-secondary">No small arms equipment found</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
