import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Searching for webp filename...");
  const accounts = await prisma.thinkpagesAccount.findMany({
    where: {
      profileImageUrl: { contains: "uploaded_1780129998183_2f010115_vlody6svb1nf1.webp" },
    },
  });
  console.log("Matching Accounts:", accounts);

  const countries = await prisma.country.findMany({
    where: {
      flag: { contains: "uploaded_1780129998183_2f010115_vlody6svb1nf1.webp" },
    },
  });
  console.log("Matching Countries:", countries);

  const attachments = await prisma.mediaAttachment.findMany({
    where: {
      url: { contains: "uploaded_1780129998183_2f010115_vlody6svb1nf1.webp" },
    },
  });
  console.log("Matching MediaAttachments:", attachments);

  console.log("Recent Attachments:");
  console.log(JSON.stringify(attachments, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
