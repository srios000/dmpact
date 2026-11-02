import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} in .env before seeding.`);
  return value;
}

async function signUpDemoUser(email: string, password: string) {
  const response = await fetch(
    `${required("NEON_AUTH_BASE_URL")}/sign-up/email`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: required("APP_BASE_URL"),
      },
      body: JSON.stringify({ email, password, name: "Demo Creator" }),
    },
  );
  if (!response.ok && response.status !== 422) {
    throw new Error(`Neon Auth sign-up failed with ${response.status}.`);
  }
}

async function main() {
  const email = required("DEMO_CREATOR_EMAIL").toLowerCase();
  const password = required("DEMO_CREATOR_PASSWORD");
  const paypalEmail = required("DEMO_CREATOR_PAYPAL_EMAIL");

  await signUpDemoUser(email, password);

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: required("DIRECT_URL") }),
  });
  try {
    const [user] = await db.$queryRaw<{ id: string }[]>`
      SELECT id::text FROM neon_auth."user" WHERE email = ${email}
    `;
    if (!user) throw new Error("The demo user isn't in neon_auth.user.");

    await db.creator.upsert({
      where: { authUserId: user.id },
      update: { paypalEmail },
      create: {
        authUserId: user.id,
        email,
        displayName: "Demo Creator",
        paypalEmail,
      },
    });
    console.log("Seeded the demo creator.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
