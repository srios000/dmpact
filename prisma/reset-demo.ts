import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  describeSeeded,
  resetDemoCommissions,
} from "../src/lib/demo/demo-commissions";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in .env before resetting.`);
  return value;
}

async function main() {
  const email = required("DEMO_CREATOR_EMAIL").toLowerCase();
  const clientPaypalEmail = required("DEMO_CLIENT_PAYPAL_EMAIL");
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: required("DIRECT_URL") }),
  });
  try {
    const creator = await db.creator.findUnique({ where: { email } });
    if (!creator) throw new Error("Run pnpm db:seed first.");
    const seeded = await resetDemoCommissions(
      db,
      creator.id,
      clientPaypalEmail,
    );
    console.log(`Replaced the demo commissions with ${seeded.length}:`);
    console.log(describeSeeded(seeded, required("APP_BASE_URL")));
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
