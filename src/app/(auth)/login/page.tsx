import { DmExample } from "./_components/dm-example";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r bg-card p-12 lg:flex">
        <span className="text-lg font-semibold text-foreground">DMpact</span>
        <DmExample />
        <span aria-hidden />
      </section>

      <section className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm space-y-8">
          <p className="text-lg font-semibold text-foreground lg:hidden">
            DMpact
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Log in
          </h1>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
