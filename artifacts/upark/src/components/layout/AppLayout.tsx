import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
  children: ReactNode;
  showNav?: boolean;
  className?: string;
}

export function AppLayout({ children, showNav = true, className = "" }: AppLayoutProps) {
  return (
    <div className={`min-h-[100dvh] bg-background flex flex-col ${className}`}>
      <main className={`flex-1 flex flex-col ${showNav ? "pb-16" : ""} relative`}>
        {children}
      </main>
      {showNav && <BottomNav />}
    </div>
  );
}
