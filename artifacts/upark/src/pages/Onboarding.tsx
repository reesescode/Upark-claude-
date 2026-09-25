import { useEffect, useRef, useState } from "react";
import { ArrowRight, CircleAlert, Compass, MapPin, Navigation, Search } from "lucide-react";
import { AttributionControl, MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";

type OnboardingProps = {
  onFinish: () => Promise<void> | void;
};

const slides = [
  {
    title: "Welcome to U Park",
    description: "Find parking faster and get to class easier.",
  },
  {
    title: "Find Open Parking",
    description: "See which campus garages have available spots.",
  },
  {
    title: "Choose the Best Garage",
    description: "Help users find the best garage based on where their class is.",
  },
  {
    title: "Navigate to Class",
    description: "After parking, give users walking directions from the garage to their class.",
  },
] as const;

const CAMPUS_CENTER: [number, number] = [26.462647, -81.779026];

function KeepCampusCentered() {
  const map = useMap();

  useEffect(() => {
    const centerMap = () => {
      map.invalidateSize({ pan: false });
      map.setView(CAMPUS_CENTER, 16, { animate: false });
    };
    const frame = requestAnimationFrame(centerMap);
    const observer = new ResizeObserver(centerMap);
    observer.observe(map.getContainer());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

function CampusMapIllustration({ step }: { step: number }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[24px] border-4 border-white bg-[#E8F0F2] shadow-xl"
      role="img"
      aria-label="Illustration of the FGCU campus on an OpenStreetMap map"
    >
      <MapContainer
        key={step}
        center={CAMPUS_CENTER}
        zoom={16}
        zoomControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        keyboard={false}
        attributionControl={false}
        className="h-full w-full"
      >
        <KeepCampusCentered />
        <AttributionControl position="bottomright" prefix={false} />
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
      </MapContainer>

      {/* These are tutorial cues, not parking data or a calculated route. */}
      {step === 1 && (
        <>
          <div className="absolute left-3 right-3 top-3 z-[400] flex h-12 items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 shadow-lg">
            <Search size={19} className="shrink-0 text-gray-400" aria-hidden="true" />
            <span className="text-sm font-medium text-gray-500">Search campus...</span>
          </div>
           <div className="absolute left-1/2 top-1/2 z-[400] -translate-x-1/2 -translate-y-1/2">
            <div className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-[3px] border-white bg-primary text-primary-foreground shadow-xl">
              <MapPin size={22} aria-hidden="true" />
            </div>
            <div className="mx-auto -mt-1 h-3 w-3 rotate-45 bg-white shadow-sm" />
          </div>
        </>
      )}
      {step === 2 && (
        <div className="absolute bottom-5 left-4 right-4 z-[400] flex items-center gap-3 rounded-[24px] border border-gray-100 bg-white p-4 shadow-xl">
          <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MapPin size={24} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block text-[17px] font-bold leading-tight text-gray-900">Explore garages</span>
            <span className="block text-[13px] font-medium text-gray-500">Find the right place to park</span>
          </div>
        </div>
      )}
      {step === 3 && (
        <div className="absolute bottom-5 left-4 right-4 z-[400] rounded-[24px] border border-gray-100 bg-white p-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Navigation size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="block text-[17px] font-bold leading-tight text-gray-900">From parking to class</span>
              <span className="block text-[13px] font-medium text-gray-500">Continue on foot</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Onboarding({ onFinish }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const finishingRef = useRef(false);

  async function finish() {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setIsFinishing(true);
    setFinishError(null);
    try {
      await onFinish();
    } catch {
      setFinishError("Couldn't finish the tutorial. Please try again.");
      setIsFinishing(false);
      finishingRef.current = false;
    }
  }

  function goToStep(nextStep: number) {
    if (finishingRef.current) return;
    setStep(nextStep);
    setFinishError(null);
  }

  return (
    <main className="min-h-[100dvh] bg-[#E8F0F2] font-sans">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-primary shadow-xl">
        <header className="flex items-center justify-between px-5 pb-2 pt-7 sm:px-6" style={{ paddingTop: "max(1.75rem, env(safe-area-inset-top))" }}>
          <div className="flex items-center gap-2.5" aria-label="UPARK">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
              <MapPin size={20} strokeWidth={2.5} aria-hidden="true" />
            </span>
            <span className="text-lg font-black tracking-tight text-white">UPARK</span>
          </div>
          <button
            type="button"
            onClick={() => void finish()}
            disabled={isFinishing}
            data-testid="button-skip-onboarding"
            className="min-h-11 rounded-xl px-3 text-sm font-semibold text-white/90 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
          >
            Skip
          </button>
        </header>

        <div className="flex min-h-[220px] flex-1 items-center justify-center px-6 py-7 sm:px-8">
          {step === 0 ? (
            <div className="relative flex aspect-square w-full max-w-[290px] items-center justify-center" aria-hidden="true">
              <div className="absolute inset-3 rounded-full border border-white/20" />
              <div className="absolute inset-10 rounded-full border border-white/20" />
              <div className="absolute inset-[72px] rounded-full bg-white/10" />
              <div className="relative flex h-28 w-28 items-center justify-center rounded-3xl bg-white shadow-2xl">
                <MapPin className="h-14 w-14 text-primary" strokeWidth={2.5} />
              </div>
              <div className="absolute bottom-7 right-5 flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-primary bg-white text-primary shadow-lg">
                <Compass size={24} />
              </div>
            </div>
          ) : (
            <div className="h-[clamp(220px,42dvh,390px)] w-full max-w-[370px]">
              <CampusMapIllustration step={step} />
            </div>
          )}
        </div>

        <section
          className="relative rounded-t-[32px] bg-white px-6 pb-6 pt-8 text-center sm:px-8"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          aria-labelledby="onboarding-title"
        >
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-primary" data-testid="text-onboarding-step">
            {step + 1} of {slides.length}
          </p>
          <h1 id="onboarding-title" className="text-[28px] font-black leading-[1.12] tracking-tight text-gray-900" data-testid="text-onboarding-title">
            {slides[step].title}
          </h1>
          <p className="mx-auto mt-3 min-h-[48px] max-w-[315px] text-base font-medium leading-6 text-gray-500" data-testid="text-onboarding-description">
            {slides[step].description}
          </p>

          <div className="mt-7 flex items-center justify-center gap-2" aria-label={`Tutorial progress, step ${step + 1} of ${slides.length}`}>
            {slides.map((slide, index) => (
              <button
                type="button"
                key={slide.title}
                onClick={() => goToStep(index)}
                disabled={isFinishing}
                aria-label={`Go to step ${index + 1}: ${slide.title}`}
                aria-current={index === step ? "step" : undefined}
                data-testid={`button-onboarding-step-${index + 1}`}
                className="flex h-11 w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
              >
                <span className={`block h-2 rounded-full transition-all ${index === step ? "w-6 bg-primary" : "w-2 bg-gray-300"}`} />
              </button>
            ))}
          </div>

          {finishError && (
            <p role="alert" data-testid="text-onboarding-error" className="mt-2 flex items-center justify-center gap-2 text-sm font-semibold text-destructive">
              <CircleAlert size={16} aria-hidden="true" />
              {finishError}
            </p>
          )}

          <Button
            type="button"
            onClick={() => step === slides.length - 1 ? void finish() : goToStep(step + 1)}
            disabled={isFinishing}
            data-testid="button-onboarding-next"
            className="mt-5 h-14 w-full rounded-2xl text-base font-bold shadow-sm shadow-primary/20"
          >
            {isFinishing ? "Getting started..." : step === slides.length - 1 ? "Get Started" : "Next"}
            {!isFinishing && <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />}
          </Button>
        </section>
      </div>
    </main>
  );
}