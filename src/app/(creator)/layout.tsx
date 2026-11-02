import { AppShell } from "@/components/templates/app-shell";

export default function CreatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
