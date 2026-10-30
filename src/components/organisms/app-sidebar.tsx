"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  HomeIcon,
  ListIcon,
  SettingsIcon,
  LogOutIcon,
  PlusIcon,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navMain = [
  { title: "Dashboard", url: "/", icon: HomeIcon },
  { title: "Queue", url: "/queue", icon: ListIcon },
  { title: "New commission", url: "/new", icon: PlusIcon },
  { title: "Settings", url: "/settings", icon: SettingsIcon },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  const isActivePath = React.useCallback(
    (url: string) => {
      if (url === "/") return pathname === "/"
      return pathname === url || pathname.startsWith(`${url}/`)
    },
    [pathname]
  )

  return (
    <Sidebar variant="sidebar" className="border-none bg-transparent" {...props}>
      <div className="m-4 flex h-[calc(100svh-2rem)] flex-col overflow-hidden rounded-[2.5rem] border-2 border-white bg-primary shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <SidebarHeader className="p-6 pb-4 md:p-8 md:pb-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-4">
                <div className="flex size-12 items-center justify-center rounded-full border-2 border-indigo-300/30 bg-indigo-500 text-xl font-black text-white shadow-[0_0_20px_rgba(99,102,241,0.3)]">
                  H
                </div>
                <div className="rounded-md border-2 border-indigo-300/50 px-3 py-1">
                  <span className="text-xs font-black tracking-[0.2em] text-indigo-200 uppercase">
                    DMpact
                  </span>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="px-4 py-6">
          <div className="mb-6 px-4">
            <span className="text-[10px] font-black tracking-[0.3em] text-white/30 uppercase">
              Main Menu
            </span>
          </div>
          <SidebarMenu className="gap-1">
            {navMain.map((item) => {
              const isActive = isActivePath(item.url)

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    className={`group rounded-xl px-4 py-6 transition-all duration-300 ${
                      isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                    }`}
                    render={
                      <Link href={item.url} className="flex w-full items-center gap-4">
                        <item.icon
                          className={`size-5 ${isActive ? "text-white" : "text-white/40 group-hover:text-white"}`}
                        />
                        <span className="text-sm font-bold tracking-tight">{item.title}</span>
                      </Link>
                    }
                  />
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="mt-auto p-6">
          <div className="space-y-1">
            <SidebarMenuButton
              className="group w-full justify-start gap-4 rounded-xl px-4 py-4 text-white/60 hover:bg-blue-500/10 hover:text-blue-400"
              render={
                <div className="flex w-full items-center gap-4">
                  <LogOutIcon className="size-4 text-white/40 group-hover:text-blue-400" />
                  <span className="text-xs font-bold">Logout</span>
                </div>
              }
            />
          </div>
        </SidebarFooter>
      </div>
    </Sidebar>
  )
}
