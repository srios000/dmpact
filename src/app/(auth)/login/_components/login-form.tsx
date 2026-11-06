"use client";

import { useActionState } from "react";
import { ArrowRightIcon, KeyRoundIcon, MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { login } from "../actions";

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, null);

  return (
    <form action={formAction} className="flex w-full flex-col gap-6">
      <div className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="login-email"
            className="text-xs font-black tracking-widest text-muted-foreground uppercase"
          >
            Email address
          </label>
          <div className="relative">
            <MailIcon className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="h-14 pl-12"
              placeholder="creator@example.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="login-password"
            className="text-xs font-black tracking-widest text-muted-foreground uppercase"
          >
            Password
          </label>
          <div className="relative">
            <KeyRoundIcon className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-14 pl-12"
              placeholder="••••••••"
            />
          </div>
        </div>
      </div>

      {state?.error && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-4 text-center text-sm font-bold text-destructive"
        >
          {state.error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="mt-2 h-14 w-full"
      >
        {isPending ? "Logging in..." : "Log in"}
        {!isPending && <ArrowRightIcon data-icon="inline-end" />}
      </Button>
    </form>
  );
}
