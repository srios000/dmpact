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
    <Sidebar {...props}>
      <SidebarHeader className="px-6 pt-6 pb-8">
        <Link
          href="/"
          onClick={() => setOpenMobile(false)}
          className="w-fit rounded-md text-lg font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          DMpact
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4">
        <SidebarMenu className="gap-1">
          {navMain.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                size="lg"
                tooltip={item.title}
                isActive={item.url === activeUrl}
                className="relative h-10"
                render={
                  <Link href={item.url} onClick={() => setOpenMobile(false)} />
                }
              >
                {item.url === activeUrl && (
                  <span className="absolute left-0 h-6 w-1 rounded-full bg-primary" />
                )}
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
            <form action={logout} className="w-full">
              <SidebarMenuButton
                size="lg"
                tooltip="Log out"
                type="submit"
                className="h-10"
              >
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
