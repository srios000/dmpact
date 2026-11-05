"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/organisms/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="relative flex min-h-svh w-full bg-[#050608]">
          {/* Dynamic Mesh Gradient Background */}
          <div className="bg-mesh pointer-events-none fixed inset-0 z-0 opacity-40" />

          <AppSidebar collapsible="offcanvas" />

          <SidebarInset className="relative z-10 flex-1 bg-transparent p-0">
            <header className="sticky top-0 z-50 flex h-20 shrink-0 items-center px-8">
              <SidebarTrigger className="size-10 rounded-xl bg-white/5 text-white/40 backdrop-blur-xl transition-all hover:scale-110 hover:bg-white/10 hover:text-white" />
            </header>
            <main className="flex min-h-full w-full flex-col">{children}</main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export { AppShell };
