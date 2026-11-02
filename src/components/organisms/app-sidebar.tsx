"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListIcon, LogOutIcon, PlusIcon, SettingsIcon } from "lucide-react";

import { logout } from "@/app/(creator)/actions";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navMain = [
  { title: "Queue", url: "/commissions", icon: ListIcon },
  { title: "New commission", url: "/commissions/new", icon: PlusIcon },
  { title: "Settings", url: "/settings/rate-card", icon: SettingsIcon },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const activeUrl = navMain
    .map((item) => item.url)
    .filter((url) => pathname === url || pathname.startsWith(`${url}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <Sidebar
      variant="floating"
      className="p-4 [&>[data-slot=sidebar-inner]]:rounded-[2.5rem] [&>[data-slot=sidebar-inner]]:shadow-xl"
      {...props}
    >
      <SidebarHeader className="p-6 pb-4">
        <Link
          href="/"
          onClick={() => setOpenMobile(false)}
          className="w-fit rounded-md border-2 border-sidebar-border px-3 py-1 text-xs font-black tracking-[0.2em] text-sidebar-accent-foreground uppercase ring-sidebar-ring outline-hidden focus-visible:ring-2"
        >
          DMpact
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4 py-6">
        <SidebarMenu className="gap-1">
          {navMain.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                size="lg"
                tooltip={item.title}
                isActive={item.url === activeUrl}
                render={
                  <Link href={item.url} onClick={() => setOpenMobile(false)} />
                }
              >
                <item.icon />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="px-4 pb-6">
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={logout}>
              <SidebarMenuButton size="lg" tooltip="Log out" type="submit">
                <LogOutIcon />
                <span>Log out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
