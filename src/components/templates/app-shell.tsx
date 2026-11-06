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
        <div className="bg-mesh pointer-events-none fixed inset-0 opacity-60" />
        <AppSidebar />
        <SidebarInset className="bg-transparent">
          <header className="sticky top-0 z-50 flex h-16 shrink-0 items-center px-4 md:px-8">
            <SidebarTrigger className="-ml-1" />
          </header>
          <div className="relative flex min-w-0 flex-1 flex-col">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

export { AppShell };
