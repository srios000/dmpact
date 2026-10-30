import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/templates/app-shell";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "DMpact | Creator Commission Suite",
  description: "Manage your DM commissions with AI and PayPal",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body className="antialiased">
        <Suspense fallback={<main className="min-h-screen bg-background">{children}</main>}>
          <AppShell>{children}</AppShell>
        </Suspense>
      </body>
    </html>
  );
}
