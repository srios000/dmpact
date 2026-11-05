import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/lib/db";
import { auth } from "./server";

export type CurrentCreator = {
  id: string;
  email: string;
  displayName: string;
  paypalEmail: string | null;
};

const SELECT = {
  id: true,
  email: true,
  displayName: true,
  paypalEmail: true,
} as const;

export const getCurrentCreator = cache(
  async (): Promise<CurrentCreator | null> => {
    await connection();

    // Dev Mode Bypass: Return a mock creator if no session is found
    if (process.env.NODE_ENV === "development") {
      const { data: session } = await auth.getSession();
      const user = session?.user;

      if (!user) {
        console.warn("Auth: No session found, using Dev Guest Mode");
        return {
          id: "dev-guest-id",
          email: "dev@example.com",
          displayName: "Dev Guest",
          paypalEmail: "dev-paypal@example.com",
        };
      }

      return db.creator.upsert({
        where: { authUserId: user.id },
        update: {},
        create: {
          authUserId: user.id,
          email: user.email,
          displayName: user.name || user.email,
        },
        select: SELECT,
      });
    }

    const { data: session } = await auth.getSession();
    const user = session?.user;
    if (!user) return null;

    return db.creator.upsert({
      where: { authUserId: user.id },
      update: {},
      create: {
        authUserId: user.id,
        email: user.email,
        displayName: user.name || user.email,
      },
      select: SELECT,
    });
  },
);
