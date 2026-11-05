import Image from "next/image";
import { SparklesIcon } from "lucide-react";
import { LoginForm } from "./_components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-svh bg-[#050608]">
      {/* Left Panel - VTuber Image & Branding */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        <Image
          src="https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=Vtuber%20anime%20girl%20in%20a%20modern%20streaming%20studio%2C%20midnight%20slate%20and%20professional%20blue%20lighting%2C%20neon%20pink%20and%20cyan%20accents%2C%20highly%20detailed%2C%204k&image_size=portrait_16_9"
          alt="VTuber Login Background"
          fill
          className="object-cover"
          sizes="50vw"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050608]/90 via-[#050608]/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/20 to-transparent" />

        <div className="absolute inset-0 flex flex-col justify-end p-16">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF3B8E] to-blue-600 shadow-[0_0_30px_rgba(255,59,142,0.4)]">
              <SparklesIcon className="size-6 text-white" />
            </div>
            <span className="text-3xl font-black tracking-tight text-white">
              /DMpact
            </span>
          </div>
          <p className="mt-6 max-w-md text-lg leading-relaxed font-medium text-slate-300">
            The ultimate command center for VTubers and digital creators. Manage
            your commissions with style.
          </p>
        </div>
      </div>

      {/* Right Panel - Form Container */}
      <div className="relative flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="bg-mesh absolute inset-0 opacity-30" />

        <div className="relative z-10 w-full max-w-md space-y-10">
          <div className="space-y-4 text-center lg:text-left">
            <h1 className="font-heading text-4xl font-black tracking-tight text-white md:text-5xl">
              Welcome{" "}
              <span className="animate-gradient text-glow bg-gradient-to-r from-[#FF3B8E] via-blue-400 to-[#FF3B8E] bg-[length:200%_auto] bg-clip-text text-transparent">
                Back.
              </span>
            </h1>
            <p className="text-base font-medium text-slate-400">
              Sign in to manage your queue and incoming requests.
            </p>
          </div>

          <div className="group relative">
            <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-[#FF3B8E] to-blue-500 opacity-20 blur-2xl transition duration-1000 group-focus-within:opacity-40" />
            <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0F1014]/60 p-8 shadow-2xl backdrop-blur-3xl md:p-10">
              <LoginForm />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
