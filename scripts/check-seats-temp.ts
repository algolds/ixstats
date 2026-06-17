import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const legislatures = await prisma.legislature.findMany({
    include: {
      seats: {
        include: { party: true }
      }
    }
  });

  console.log("Legislatures found:", legislatures.length);
  for (const leg of legislatures) {
    console.log(`Legislature ID: ${leg.id}, Name: ${leg.name}, Total Seats: ${leg.totalSeats}`);
    console.log("Seats:");
    leg.seats.slice(0, 10).forEach(s => {
      console.log(`  Seat Number: ${s.seatNumber}, Region: ${s.region}, PartyId: ${s.partyId}, Party Name: ${s.party?.name}`);
    });
    if (leg.seats.length > 10) {
      console.log(`  ... and ${leg.seats.length - 10} more seats`);
    }
  }

  const parties = await prisma.politicalParty.findMany();
  console.log("Parties found:", parties.length);
  for (const p of parties) {
    console.log(`  Party ID: ${p.id}, Name: ${p.name}, Color: ${p.color}, Support: ${p.currentSupport}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
