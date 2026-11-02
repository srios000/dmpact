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
