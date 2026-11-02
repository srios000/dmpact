import "server-only";
import { cache } from "react";

export type CurrentCreator = {
  id: string;
  email: string;
  displayName: string;
  paypalEmail: string | null;
};

// No session until Neon Auth lands in #8, so creator data stays closed.
export const getCurrentCreator = cache(
  async (): Promise<CurrentCreator | null> => null,
);
