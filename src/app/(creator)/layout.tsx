import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/templates/app-shell";
import { getCurrentCreator } from "@/lib/auth/get-current-creator";

async function RequireCreator({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "development") {
    return children;
  }

  const creator = await getCurrentCreator();
  if (!creator) redirect("/login");
  return children;
}

export default function CreatorLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<div className="min-h-svh bg-background" />}>
      <RequireCreator>
        <AppShell>{children}</AppShell>
      </RequireCreator>
    </Suspense>
  );
}
