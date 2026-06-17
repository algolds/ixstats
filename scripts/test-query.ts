import { PrismaClient } from "@prisma/client";
import { parseChambers } from "../src/server/api/routers/elections/elections";

const prisma = new PrismaClient();

async function main() {
  // Find a country that has a legislature
  const legislature = await prisma.legislature.findFirst({
    include: {
      seats: {
        include: { party: true },
        orderBy: { seatNumber: "asc" },
      },
    },
  });

  if (!legislature) {
    console.log("No legislature found");
    return;
  }

  console.log("Checking getCurrentParliament backend output for countryId:", legislature.countryId);

  const partySeatCounts = new Map<
    string,
    {
      party: {
        id: string;
        name: string;
        shortName: string | null;
        color: string;
        ideology: string;
      };
      seats: number;
    }
  >();

  for (const seat of legislature.seats) {
    if (seat.party) {
      const existing = partySeatCounts.get(seat.party.id);
      if (existing) {
        existing.seats++;
      } else {
        partySeatCounts.set(seat.party.id, {
          party: {
            id: seat.party.id,
            name: seat.party.name,
            shortName: seat.party.shortName,
            color: seat.party.color,
            ideology: seat.party.ideology,
          },
          seats: 1,
        });
      }
    }
  }

  const result = {
    legislature: {
      id: legislature.id,
      name: legislature.name,
      chamberType: legislature.chamberType,
      totalSeats: legislature.totalSeats,
      electoralSystem: legislature.electoralSystem,
      termLength: legislature.termLength,
      chambers: parseChambers(
        legislature.chamberType,
        legislature.name,
        legislature.totalSeats,
        legislature.electoralSystem
      ),
    },
    seats: legislature.seats.map((s) => ({
      seatNumber: s.seatNumber,
      partyId: s.partyId,
      partyColor: s.party?.color ?? "#94a3b8",
      partyName: s.party?.name ?? "Vacant",
      chamber: s.region ?? "Assembly",
    })),
    partySummary: Array.from(partySeatCounts.values()).sort((a, b) => b.seats - a.seats),
  };

  console.log("Query Output partySummary:", JSON.stringify(result.partySummary, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
