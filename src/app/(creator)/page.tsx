import {
  SearchIcon,
  TrendingUpIcon,
  UsersIcon,
  ZapIcon,
  ExternalLinkIcon,
} from "lucide-react";
import Image from "next/image";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      {/* Hero Section - High Impact Gradients */}
      <div className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-12 text-center">
        <div className="animate-in duration-1000 fade-in slide-in-from-top-4">
          <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
            Empower Your{" "}
            <span className="animate-gradient text-glow bg-gradient-to-r from-[#FF3B8E] via-blue-400 to-[#FF3B8E] bg-[length:200%_auto] bg-clip-text text-transparent">
              Creative Journey
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base font-medium text-slate-400 sm:text-lg">
            The ultimate command center for VTubers and digital creators.{" "}
            <br className="hidden md:block" />
            Manage commissions, track growth, and engage your community.
          </p>
        </div>

        {/* Search Bar - Sleek Glassmorphism */}
        <div className="mt-10 w-full max-w-2xl animate-in delay-200 duration-1000 zoom-in-95 fade-in">
          <div className="group relative">
            <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#FF3B8E] to-blue-500 opacity-20 blur-xl transition duration-1000 group-focus-within:opacity-40" />
            <div className="relative flex items-center rounded-2xl border border-white/5 bg-[#0F1014]/60 p-2 shadow-2xl backdrop-blur-2xl transition-all">
              <SearchIcon className="ml-4 size-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search your commissions, queue, or settings..."
                className="flex-1 bg-transparent px-4 py-3 text-base font-medium text-white outline-none placeholder:text-slate-600"
              />
              <button className="hidden rounded-xl bg-gradient-to-r from-[#FF3B8E] to-[#D42A75] px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-[#FF3B8E]/20 transition-all hover:scale-[1.02] active:scale-[0.98] md:block">
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Hero Stats - Glow Cards */}
        <div className="mt-12 flex animate-in flex-wrap justify-center gap-6 delay-400 duration-1000 fade-in">
          {[
            {
              label: "Active Queue",
              value: "12",
              icon: ZapIcon,
              color: "text-[#FF3B8E]",
              glow: "shadow-[#FF3B8E]/10",
            },
            {
              label: "Subscribers",
              value: "8.4k",
              icon: UsersIcon,
              color: "text-blue-400",
              glow: "shadow-blue-400/10",
            },
            {
              label: "Growth",
              value: "+24%",
              icon: TrendingUpIcon,
              color: "text-emerald-400",
              glow: "shadow-emerald-400/10",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] px-6 py-4 shadow-xl backdrop-blur-md ${stat.glow}`}
            >
              <div
                className={`flex size-10 items-center justify-center rounded-xl bg-white/5 ${stat.color}`}
              >
                <stat.icon className="size-5" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-2xl leading-none font-black text-white">
                  {stat.value}
                </span>
                <span className="mt-1 text-[10px] font-black tracking-[0.2em] text-slate-500 uppercase">
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area - Refined Cards */}
      <div className="relative z-10 flex-1 px-6 pb-20 md:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-1.5 rounded-full bg-gradient-to-b from-[#FF3B8E] to-blue-500" />
              <h2 className="text-2xl font-black tracking-tight text-white">
                Featured Commissions
              </h2>
            </div>
            <button className="text-sm font-bold text-[#FF3B8E] transition-colors hover:text-[#D42A75]">
              View All Queue
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[
              {
                id: 1,
                name: "Live2D Model Rigging",
                client: "@Kizuna_01",
                status: "In Progress",
                price: "$450",
                image:
                  "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=Live2D%20anime%20girl%20model%20preview%2C%20highly%20detailed%2C%20pink%20hair%2C%20digital%20art&image_size=square",
              },
              {
                id: 2,
                name: "Custom Emote Pack",
                client: "@CyberGhost",
                status: "Review",
                price: "$80",
                image:
                  "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=Chibi%20anime%20emotes%20grid%2C%20cute%2C%20colorful%2C%20digital%20art&image_size=square",
              },
              {
                id: 3,
                name: "Concept Art #04",
                client: "@StudioMura",
                status: "Agreed",
                price: "$220",
                image:
                  "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=Fantasy%20landscape%20concept%20art%2C%20mystical%20forest%2C%20anime%20style&image_size=square",
              },
              {
                id: 4,
                name: "Intro Animation",
                client: "@V-Nebula",
                status: "Draft",
                price: "$150",
                image:
                  "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=Space%20themed%20motion%20graphics%20background%2C%20purple%20nebula%2C%20anime%20style&image_size=square",
              },
            ].map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] transition-all hover:-translate-y-1 hover:border-[#FF3B8E]/30 hover:shadow-2xl hover:shadow-[#FF3B8E]/5"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F1014] via-transparent to-transparent opacity-60" />
                  <div className="absolute top-3 right-3 rounded-lg border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] font-black text-white uppercase backdrop-blur-md">
                    {item.status}
                  </div>
                </div>
                <div className="flex flex-col p-6">
                  <h3 className="line-clamp-1 text-lg font-bold text-white transition-colors group-hover:text-[#FF3B8E]">
                    {item.name}
                  </h3>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">
                      {item.client}
                    </span>
                    <span className="text-lg font-black text-white">
                      {item.price}
                    </span>
                  </div>
                  <button className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-white/5 py-3 text-xs font-bold text-slate-300 transition-all hover:bg-[#FF3B8E] hover:text-white">
                    Manage Order <ExternalLinkIcon className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
