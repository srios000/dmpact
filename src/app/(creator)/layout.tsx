import { Suspense } from "react";
import { AppShell } from "@/components/templates/app-shell";

export default function CreatorLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
