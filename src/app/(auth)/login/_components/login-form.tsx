"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "../actions";
import { ArrowRightIcon, MailIcon, KeyRoundIcon } from "lucide-react";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <form action={formAction} className="flex w-full flex-col gap-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-black tracking-widest text-slate-400 uppercase">
            Email Address
          </label>
          <div className="relative">
            <MailIcon className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-500" />
            <Input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-14 rounded-2xl border-white/10 bg-white/5 pl-12 text-base font-medium text-white placeholder:text-slate-600 focus:border-[#FF3B8E]/50 focus:bg-white/10 focus:ring-[#FF3B8E]/20"
              placeholder="creator@example.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black tracking-widest text-slate-400 uppercase">
            Password
          </label>
          <div className="relative">
            <KeyRoundIcon className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-slate-500" />
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-14 rounded-2xl border-white/10 bg-white/5 pl-12 text-base font-medium text-white placeholder:text-slate-600 focus:border-blue-500/50 focus:bg-white/10 focus:ring-blue-500/20"
              placeholder="••••••••"
            />
          </div>
        </div>
      </div>

      {state?.error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center">
          <p role="alert" className="text-sm font-bold text-red-400">
            {state.error}
          </p>
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="group relative mt-2 h-14 w-full overflow-hidden rounded-2xl bg-white text-base font-black text-black shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isPending ? "AUTHENTICATING..." : "LOG IN TO DASHBOARD"}
          {!isPending && (
            <ArrowRightIcon className="size-5 transition-transform group-hover:translate-x-1" />
          )}
        </span>
      </Button>
    </form>
  );
}
