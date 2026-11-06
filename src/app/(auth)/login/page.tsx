import { SparklesIcon } from "lucide-react";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh bg-background">
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        <div className="bg-mesh absolute inset-0 opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-16">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/40">
              <SparklesIcon className="size-6 text-primary-foreground" />
            </div>
            <span className="text-3xl font-black tracking-tight text-foreground">
              /DMpact
            </span>
          </div>
          <p className="mt-6 max-w-md text-lg leading-relaxed font-medium text-muted-foreground">
            Turn commission DMs into clear agreements, deposits, and deliveries.
          </p>
        </div>
      </div>

      <div className="relative flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="bg-mesh absolute inset-0 opacity-30" />

        <div className="relative z-10 w-full max-w-md space-y-10">
          <div className="space-y-4 text-center lg:text-left">
            <h1 className="font-heading text-4xl font-black tracking-tight text-foreground md:text-5xl">
              Welcome{" "}
              <span className="animate-gradient text-glow bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_auto] bg-clip-text text-transparent">
                back.
              </span>
            </h1>
            <p className="text-base font-medium text-muted-foreground">
              Log in to manage your queue and incoming requests.
            </p>
          </div>

          <div className="rounded-[2.5rem] border bg-card p-8 shadow-2xl backdrop-blur-3xl md:p-10">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
