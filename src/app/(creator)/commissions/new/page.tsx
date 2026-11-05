import { ExtractionReview } from "./_components/extraction-review";
import Image from "next/image";

export default async function NewCommissionPage() {
  return (
    <div className="relative flex min-h-svh flex-1 flex-col overflow-hidden p-6 md:p-12">
      {/* Immersive Background Illustration */}
      <div className="absolute inset-0 z-0">
        <Image
          src="https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=Celestial%20Vtuber%20studio%20background%2C%20nebula%20and%20stars%2C%20anime%20style%2C%20midnight%20slate%20and%20indigo%20tones%2C%20high%20contrast%2C%20professional%20digital%20art%2C%204k&image_size=landscape_16_9"
          alt="Celestial Studio Background"
          fill
          className="object-cover opacity-30 mix-blend-screen"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-background/60 to-background" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-8">
        <div className="flex flex-col items-center text-center">
          <h1 className="font-heading text-4xl font-black tracking-tighter text-primary md:text-6xl">
            Extract <span className="text-indigo-600">Agreement.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg font-medium text-muted-foreground">
            Paste your client&apos;s DM. We&apos;ll use AI to identify
            deliverables, rates, and terms so you can stay focused on creating.
          </p>
        </div>

        <ExtractionReview />
      </div>
    </div>
  );
}
