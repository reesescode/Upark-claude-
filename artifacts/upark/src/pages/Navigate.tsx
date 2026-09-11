import { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetGarage } from "@workspace/api-client-react";
import { X, Navigation2, ArrowUpRight, ArrowRight, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Navigate() {
  const { id } = useParams<{ id: string }>();
  const { data: garage, isLoading } = useGetGarage(id!);
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);

  const steps = [
    { text: "Head north on University Ave", distance: "0.2 mi", icon: ArrowUpRight },
    { text: "Turn right onto College Rd", distance: "500 ft", icon: ArrowRight },
    { text: `Arrive at ${garage?.shortName || 'Garage'}`, distance: "Destination", icon: Flag },
  ];

  // Simulate progress
  useEffect(() => {
    if (isLoading) return;
    
    const timer = setInterval(() => {
      setStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        clearInterval(timer);
        return prev;
      });
    }, 4000); // Progress every 4 seconds for demo

    return () => clearInterval(timer);
  }, [isLoading, steps.length]);

  if (isLoading || !garage) {
    return <div className="h-screen w-full bg-gray-900 flex items-center justify-center" />;
  }

  const currentStep = steps[step];
  const CurrentIcon = currentStep.icon;

  return (
    <div className="h-[100dvh] w-full bg-gray-900 relative overflow-hidden flex flex-col font-sans">
      {/* 3D Map Perspective Mock */}
      <div className="absolute inset-0 opacity-40" style={{
        backgroundImage: "radial-gradient(circle at 50% 120%, rgba(13, 110, 253, 0.4), transparent 60%), linear-gradient(0deg, #111827 0%, #000 100%)"
      }}>
        {/* Grid lines */}
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          transform: 'perspective(500px) rotateX(60deg) translateY(-100px) scale(2)',
          transformOrigin: '50% 100%'
        }} />
        
        {/* Navigation line mock */}
        <div className="absolute bottom-[20%] left-1/2 -translate-x-1/2 w-4 h-[40vh] bg-gradient-to-t from-primary to-transparent blur-[2px]" 
             style={{ transform: 'perspective(500px) rotateX(60deg)' }} />
      </div>

      {/* Top Banner - Instructions */}
      <div className="relative z-10 p-4 pt-12 animate-in slide-in-from-top-10 duration-500">
        <div className="bg-[#1C2433] rounded-3xl p-6 shadow-2xl border border-white/10 flex items-center gap-6">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center shrink-0">
            <CurrentIcon className="text-primary w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight mb-1">{currentStep.text}</h2>
            <span className="text-primary-foreground/70 font-semibold text-lg">{currentStep.distance}</span>
          </div>
        </div>
      </div>

      {/* Main spacer */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center">
        {/* Navigation arrow (animated pulse) */}
        <div className="w-24 h-24 relative mb-20">
          <div className="absolute inset-0 bg-primary/30 rounded-full animate-ping" />
          <div className="absolute inset-4 bg-primary/40 rounded-full animate-ping" style={{ animationDelay: '200ms' }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Navigation2 className="text-primary w-16 h-16 drop-shadow-[0_0_15px_rgba(13,110,253,0.8)] -mt-2" fill="currentColor" />
          </div>
        </div>
      </div>

      {/* Bottom Panel */}
      <div className="relative z-10 bg-[#1C2433] rounded-t-3xl pb-safe-8 border-t border-white/5 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="p-6">
          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-white/60 font-semibold mb-1 uppercase tracking-wider text-xs">Arriving at</p>
              <h3 className="text-2xl font-bold text-white">{garage.name}</h3>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-green-400">{garage.driveTimeMinutes}</span>
              <span className="text-white/60 font-semibold ml-1">min</span>
              <p className="text-white/60 text-sm font-medium mt-0.5">{garage.distanceMiles} mi</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => setLocation(`/garages/${id}`)}
              className="flex-1 bg-white/10 hover:bg-white/15 text-white h-16 rounded-2xl font-bold text-lg flex items-center justify-center transition-colors"
            >
              Exit
            </button>
            <button 
              className="w-16 h-16 bg-red-500/20 text-red-500 rounded-2xl flex items-center justify-center hover:bg-red-500/30 transition-colors"
              onClick={() => setLocation(`/garages/${id}`)}
            >
              <X size={28} strokeWidth={3} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
