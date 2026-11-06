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
      <SidebarHeader className="p-8 pb-12">
        <Link
          href="/"
          onClick={() => setOpenMobile(false)}
          className="group relative flex items-center gap-3"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
            <span className="text-lg font-black text-primary-foreground">
              D
            </span>
          </div>
          <span className="text-2xl font-black tracking-tighter text-foreground transition-opacity group-hover:opacity-80">
            /DMpact
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-4">
        <SidebarMenu className="gap-2">
          {navMain.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                size="lg"
                tooltip={item.title}
                isActive={item.url === activeUrl}
                className="relative h-12"
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

      <SidebarFooter className="p-6 pb-10">
        <SidebarMenu>
          <SidebarMenuItem>
            <form action={logout} className="w-full">
              <SidebarMenuButton
                size="lg"
                tooltip="Log out"
                type="submit"
                className="h-12"
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
