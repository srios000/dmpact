import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found | DMpact",
};

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="flex w-full max-w-md flex-col items-start gap-6 rounded-[2.5rem] bg-sidebar p-8 text-sidebar-foreground shadow-xl">
        <span className="rounded-md border-2 border-sidebar-border px-3 py-1 text-xs font-black tracking-[0.2em] text-sidebar-accent-foreground uppercase">
          DMpact
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold text-sidebar-accent-foreground">
            This page doesn&apos;t exist
          </h1>
          <p>
            The link may be wrong or out of date. If someone sent it to you, ask
            them for a new one.
          </p>
        </div>
        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href="/" />}
        >
          Go to DMpact
        </Button>
      </div>
    </main>
  );
}
