import { AppLayout } from "@/components/layout/AppLayout";
import { useUser } from "@/hooks/use-local-data";
import { LogOut, Settings, Bell, CircleHelp, Shield, ChevronRight, User as UserIcon, Activity } from "lucide-react";
import { useLocation } from "wouter";
import { useHealthCheck } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";

export default function Profile() {
  const { user, logout } = useUser();
  const [, setLocation] = useLocation();
  const { data: health } = useHealthCheck();

  const handleLogout = () => {
    logout();
    setLocation("/");
  };

  return (
    <AppLayout>
      <div className="bg-white pt-12 pb-4 px-4 sticky top-0 z-20 border-b border-gray-100 shadow-sm flex justify-between items-center">
        <h1 className="text-2xl font-black text-gray-900">Profile</h1>
        {health && (
          <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase">
            <Activity size={12} className="animate-pulse" />
            Live
          </div>
        )}
      </div>

      <div className="p-4">
        {/* User Card */}
        <div className="bg-primary text-white rounded-3xl p-6 mb-6 shadow-md relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-10%] w-[200px] h-[200px] rounded-full bg-white/10 blur-2xl"></div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
              <UserIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{user?.name || "Student"}</h2>
              <p className="text-primary-foreground/80 font-medium">ID: {user?.studentId || "N/A"}</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="bg-white rounded-3xl shadow-xs border border-gray-100 overflow-hidden mb-6">
          <MenuItem icon={<Settings className="text-gray-500" />} label="App Preferences" />
          <div className="h-px bg-gray-50 ml-14"></div>
          <MenuItem icon={<Bell className="text-gray-500" />} label="Notifications" />
          <div className="h-px bg-gray-50 ml-14"></div>
          <MenuItem icon={<Shield className="text-gray-500" />} label="Privacy & Data" />
          <div className="h-px bg-gray-50 ml-14"></div>
          <MenuItem icon={<CircleHelp className="text-gray-500" />} label="Help & Support" />
        </div>

        {/* Logout */}
        <button 
          onClick={handleLogout}
          className="w-full bg-white rounded-3xl p-5 flex items-center justify-center gap-2 text-red-500 font-bold active:scale-95 transition-all shadow-xs border border-gray-100"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </AppLayout>
  );
}

function MenuItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
          {icon}
        </div>
        <span className="font-semibold text-gray-700">{label}</span>
      </div>
      <ChevronRight className="text-gray-300" size={20} />
    </button>
  );
}

