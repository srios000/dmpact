"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  ListIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";

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
  { title: "Dashboard", url: "/", icon: LayoutDashboardIcon },
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
    <Sidebar className="w-[280px] bg-[#0A0B0E]/60 backdrop-blur-3xl" {...props}>
      <SidebarHeader className="p-8 pb-12">
        <Link
          href="/"
          onClick={() => setOpenMobile(false)}
          className="group relative flex items-center gap-3"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF3B8E] to-blue-600 shadow-lg shadow-[#FF3B8E]/20">
            <span className="text-lg font-black text-white">D</span>
          </div>
          <span className="text-2xl font-black tracking-tighter text-white transition-opacity group-hover:opacity-80">
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
                className="group relative h-12 rounded-xl border border-transparent font-bold text-slate-500 transition-all hover:bg-white/5 hover:text-white data-[active=true]:bg-white/5 data-[active=true]:text-white"
                render={
                  <Link href={item.url} onClick={() => setOpenMobile(false)} />
                }
              >
                {item.url === activeUrl && (
                  <div className="absolute left-0 h-6 w-1 rounded-full bg-[#FF3B8E] shadow-[0_0_10px_rgba(255,59,142,0.8)]" />
                )}
                <item.icon
                  className={`size-5 transition-transform group-hover:scale-110 ${item.url === activeUrl ? "text-[#FF3B8E]" : ""}`}
                />
                <span className="text-[14px] tracking-wide">{item.title}</span>
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
                className="h-12 rounded-xl border border-transparent font-bold text-rose-500/40 transition-all hover:bg-rose-500/10 hover:text-rose-400"
              >
                <LogOutIcon className="size-5" />
                <span className="text-[14px] tracking-wide">Log out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
