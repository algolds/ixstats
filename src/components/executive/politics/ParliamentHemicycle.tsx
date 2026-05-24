"use client";

import { useMemo } from "react";

interface SeatData {
  seatNumber: number;
  partyColor: string;
  partyName: string;
}

interface PartySummary {
  party: { id: string; name: string; shortName: string | null; color: string };
  seats: number;
}

interface ParliamentHemicycleProps {
  seats: SeatData[];
  totalSeats: number;
  partySummary: PartySummary[];
  legislatureName?: string;
}

export function ParliamentHemicycle({
  seats,
  totalSeats,
  partySummary,
  legislatureName,
}: ParliamentHemicycleProps) {
  // Generate hemicycle layout coordinates
  const seatPositions = useMemo(() => {
    if (seats.length === 0) return [];

    // Arrange seats in concentric semicircular rows
    // Outer rows have more seats; inner rows fewer
    const rows: number[] = [];
    let remaining = totalSeats;

    // Calculate row sizes: inner rows smaller, outer rows larger
    const numRows = Math.max(3, Math.ceil(Math.sqrt(totalSeats / 3)));
    for (let r = 0; r < numRows && remaining > 0; r++) {
      const rowCapacity = Math.ceil(
        (totalSeats / numRows) * (0.6 + 0.4 * (r / Math.max(1, numRows - 1)))
      );
      const seatsInRow = Math.min(rowCapacity, remaining);
      rows.push(seatsInRow);
      remaining -= seatsInRow;
    }

    // Redistribute any remainder to last row
    if (remaining > 0 && rows.length > 0) {
      rows[rows.length - 1]! += remaining;
    }

    const positions: { x: number; y: number; color: string; name: string }[] = [];
    const cx = 200; // Center x
    const cy = 195; // Center y (bottom of semicircle)
    const minRadius = 60;
    const maxRadius = 180;
    let seatIdx = 0;

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const seatsInRow = rows[rowIdx]!;
      const t = rows.length > 1 ? rowIdx / (rows.length - 1) : 0.5;
      const radius = minRadius + t * (maxRadius - minRadius);

      for (let s = 0; s < seatsInRow && seatIdx < seats.length; s++) {
        // Angle from π (left) to 0 (right), distributed evenly
        const angleT = seatsInRow > 1 ? s / (seatsInRow - 1) : 0.5;
        const angle = Math.PI - angleT * Math.PI;

        const x = cx + radius * Math.cos(angle);
        const y = cy - radius * Math.sin(angle);

        const seat = seats[seatIdx]!;
        positions.push({
          x,
          y,
          color: seat.partyColor,
          name: seat.partyName,
        });
        seatIdx++;
      }
    }

    return positions;
  }, [seats, totalSeats]);

  const seatRadius = totalSeats > 300 ? 2.5 : totalSeats > 150 ? 3.5 : 4.5;

  return (
    <div className="space-y-4">
      {legislatureName && (
        <h3 className="text-muted-foreground text-center text-sm font-medium">{legislatureName}</h3>
      )}

      {/* SVG Hemicycle */}
      <div className="mx-auto" style={{ maxWidth: 420 }}>
        <svg viewBox="0 0 400 210" className="w-full">
          {seatPositions.map((pos, i) => (
            <circle
              key={i}
              cx={pos.x}
              cy={pos.y}
              r={seatRadius}
              fill={pos.color}
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="0.5"
            >
              <title>{pos.name}</title>
            </circle>
          ))}
        </svg>
      </div>

      {/* Party Legend */}
      <div className="flex flex-wrap justify-center gap-3">
        {partySummary.map((ps) => (
          <div key={ps.party.id} className="flex items-center gap-1.5 text-xs">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: ps.party.color }} />
            <span className="font-medium">{ps.party.shortName ?? ps.party.name}</span>
            <span className="text-muted-foreground">
              {ps.seats} ({((ps.seats / totalSeats) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
