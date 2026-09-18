import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useUser } from "@/hooks/use-local-data";
import {
  LogOut, Settings, Bell, CircleHelp, Shield, ChevronRight, User as UserIcon, Activity,
  ChevronLeft, CheckCircle2, Trash2, History, AlertTriangle, FileText, Send, Loader2
} from "lucide-react";
import { useLocation } from "wouter";
import {
  useHealthCheck,
  useGetUserProfile, getGetUserProfileQueryKey,
  useUpsertUserProfile,
  useUpdateUserPreferences,
  useUpdateNotificationSettings,
  useDeleteUserAccount,
  useClearUserParkingHistory,
  useCreateSupportRequest,
  useListGarages,
  UserProfileData,
  UserPreferencesDefaultParkingPreference
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";

type Screen = "menu" | "preferences" | "notifications" | "privacy" | "support" | "data";

export default function Profile() {
  const { user, logout } = useUser();
  const [, setLocation] = useLocation();
  const { data: health } = useHealthCheck();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [currentScreen, setCurrentScreen] = useState<Screen>("menu");
  const { data: profile, isLoading: isProfileLoading } = useGetUserProfile(user?.studentId || "", {
    query: {
      enabled: !!user?.studentId,
      queryKey: getGetUserProfileQueryKey(user?.studentId || ""),
      retry: false,
    }
  });

  useEffect(() => {
    if (user && !isProfileLoading && !profile) {
      setLocation("/account-setup");
    }
  }, [user, profile, isProfileLoading, setLocation]);

  const handleLogout = async () => {
    queryClient.clear();
    await logout();
  };

  if (!user) {
    return (
      <AppLayout>
        <div className="p-8 flex flex-col items-center justify-center min-h-[50vh] text-center">
          <h2 className="text-xl font-bold mb-2">Not Signed In</h2>
          <Button variant="outline" onClick={() => setLocation("/")} data-testid="button-go-home">
            Go to Home
          </Button>
        </div>
      </AppLayout>
    );
  }

  const renderScreen = () => {
    if (isProfileLoading && currentScreen !== "menu") {
      return (
        <div className="p-8 flex justify-center items-center h-40">
          <Loader2 className="animate-spin text-primary w-8 h-8" />
        </div>
      );
    }

    if (!profile && currentScreen !== "menu") {
      return (
        <div className="p-8 text-center text-gray-500">
          Failed to load profile. Please try again.
        </div>
      );
    }

    switch (currentScreen) {
      case "preferences":
        return <PreferencesScreen profile={profile!} />;
      case "notifications":
        return <NotificationsScreen profile={profile!} />;
      case "privacy":
        return <PrivacyScreen profile={profile!} viewData={() => setCurrentScreen("data")} />;
      case "support":
        return <SupportScreen profile={profile!} />;
      case "data":
        return <DataScreen profile={profile!} goBack={() => setCurrentScreen("privacy")} />;
      default:
        return (
          <>
            {/* User Card */}
            <div className="bg-primary text-white rounded-3xl p-6 mb-6 shadow-md relative overflow-hidden">
              <div className="absolute top-[-20%] right-[-10%] w-[200px] h-[200px] rounded-full bg-white/10 blur-2xl"></div>

              <div className="flex items-center gap-4 relative z-10">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                  <UserIcon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" data-testid="text-username">{profile?.displayName || user.name || "Student"}</h2>
                  <p className="text-primary-foreground/80 font-medium">{profile?.university || "UPARK student"}</p>
                </div>
              </div>
            </div>
            {profile && <ProfileDetailsEditor profile={profile} />}

            {/* Menu Items */}
            <div className="bg-white rounded-3xl shadow-xs border border-gray-100 overflow-hidden mb-6">
              <MenuItem icon={<Settings className="text-gray-500" />} label="App Preferences" onClick={() => setCurrentScreen("preferences")} testId="button-preferences" />
              <div className="h-px bg-gray-50 ml-14"></div>
              <MenuItem icon={<Bell className="text-gray-500" />} label="Notifications" onClick={() => setCurrentScreen("notifications")} testId="button-notifications" />
              <div className="h-px bg-gray-50 ml-14"></div>
              <MenuItem icon={<Shield className="text-gray-500" />} label="Privacy & Data" onClick={() => setCurrentScreen("privacy")} testId="button-privacy" />
              <div className="h-px bg-gray-50 ml-14"></div>
              <MenuItem icon={<CircleHelp className="text-gray-500" />} label="Help & Support" onClick={() => setCurrentScreen("support")} testId="button-support" />
            </div>

            {/* Logout */}
            <button
              onClick={() => void handleLogout()}
              data-testid="button-sign-out"
              className="w-full bg-white rounded-3xl p-5 flex items-center justify-center gap-2 text-red-500 font-bold active:scale-95 transition-all shadow-xs border border-gray-100"
            >
              <LogOut size={20} />
              <span>Sign Out</span>
            </button>
          </>
        );
    }
  };

  return (
    <AppLayout>
      <div className="bg-white pt-12 pb-4 px-4 sticky top-0 z-20 border-b border-gray-100 shadow-sm flex justify-between items-center h-[88px]">
        {currentScreen !== "menu" ? (
          <button
            onClick={() => setCurrentScreen("menu")}
            data-testid="button-back-menu"
            aria-label="Back to Profile"
            className="w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
        ) : (
          <h1 className="text-2xl font-black text-gray-900">Profile</h1>
        )}

        {currentScreen !== "menu" && (
          <h1 className="text-xl font-bold text-gray-900 absolute left-1/2 -translate-x-1/2">
            {currentScreen === "preferences" && "Preferences"}
            {currentScreen === "notifications" && "Notifications"}
            {currentScreen === "privacy" && "Privacy"}
            {currentScreen === "data" && "My Data"}
            {currentScreen === "support" && "Support"}
          </h1>
        )}

        {health && currentScreen === "menu" && (
          <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full text-xs font-bold uppercase" data-testid="status-health">
            <Activity size={12} className="animate-pulse" />
            Live
          </div>
        )}
      </div>

      <div className="p-4 relative">
        {renderScreen()}
      </div>
    </AppLayout>
  );
}

function MenuItem({ icon, label, onClick, testId }: { icon: React.ReactNode; label: string; onClick: () => void; testId: string }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors text-left"
    >
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

function ProfileDetailsEditor({ profile }: { profile: UserProfileData }) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(profile.firstName || "");
  const [lastName, setLastName] = useState(profile.lastName || "");
  const [university, setUniversity] = useState(profile.university || "");
  const saveProfile = useUpsertUserProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const save = async () => {
    const updated = await saveProfile.mutateAsync({
      userId: profile.userId,
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: profile.email || "",
        university: university.trim(),
      },
    });
    queryClient.setQueryData(getGetUserProfileQueryKey(profile.userId), updated);
    setEditing(false);
    toast({ title: "Profile updated", description: "Your changes have been saved." });
  };

  return (
    <div className="bg-white rounded-3xl p-5 shadow-xs border border-gray-100 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-gray-900">Account details</h3>
        <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Edit"}</Button>
      </div>
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="profile-first">First name</Label><Input id="profile-first" value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
            <div><Label htmlFor="profile-last">Last name</Label><Input id="profile-last" value={lastName} onChange={e => setLastName(e.target.value)} /></div>
          </div>
          <div><Label htmlFor="profile-university">University</Label><Input id="profile-university" value={university} onChange={e => setUniversity(e.target.value)} /></div>
          <Button className="w-full" onClick={() => void save()} disabled={saveProfile.isPending || !firstName.trim() || !university.trim()}>
            {saveProfile.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      ) : (
        <div className="text-sm space-y-2">
          <p><span className="text-gray-500">Email:</span> {profile.email}</p>
          <p><span className="text-gray-500">University:</span> {profile.university}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// INTERNAL SCREENS
// ---------------------------------------------------------------------------

function PreferencesScreen({ profile }: { profile: UserProfileData }) {
  const queryClient = useQueryClient();
  const updatePrefs = useUpdateUserPreferences();
  const { data: garages } = useListGarages();
  const [savedVisible, setSavedVisible] = useState(false);
  const { toast } = useToast();

  const showSaved = () => {
    setSavedVisible(true);
    setTimeout(() => setSavedVisible(false), 2000);
  };

  const handleUpdate = (updates: Partial<UserProfileData['preferences']>) => {
    const newPrefs = { ...profile.preferences, ...updates };

    // Optimistic UI update
    queryClient.setQueryData(getGetUserProfileQueryKey(profile.userId), {
      ...profile,
      preferences: newPrefs
    });

    updatePrefs.mutate({
      userId: profile.userId,
      data: newPrefs
    }, {
      onSuccess: () => showSaved(),
      onError: () => {
        toast({ title: "Error", description: "Failed to save preferences.", variant: "destructive" });
        queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(profile.userId) });
      }
    });
  };

  return (
    <div className="space-y-6 pb-8 animate-in fade-in slide-in-from-right-4 duration-300">
      {savedVisible && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4" data-testid="status-saved" role="status" aria-live="polite">
          <CheckCircle2 size={18} />
          Saved
        </div>
      )}

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-6">
        <div>
          <Label className="text-base font-bold text-gray-900 mb-3 block">Default Parking Preference</Label>
          <RadioGroup
            value={profile.preferences.defaultParkingPreference}
            onValueChange={(val: UserPreferencesDefaultParkingPreference) => handleUpdate({ defaultParkingPreference: val })}
            data-testid="input-parking-preference"
            className="space-y-3"
          >
            <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
              <RadioGroupItem value="closest" id="pref-closest" data-testid="radio-closest" />
              <Label htmlFor="pref-closest" className="font-semibold cursor-pointer flex-1">Closest to Destination</Label>
            </div>
            <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
              <RadioGroupItem value="most_available" id="pref-available" data-testid="radio-available" />
              <Label htmlFor="pref-available" className="font-semibold cursor-pointer flex-1">Most Available Spots</Label>
            </div>
            <div className="flex items-center space-x-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
              <RadioGroupItem value="lowest_occupancy" id="pref-occupancy" data-testid="radio-occupancy" />
              <Label htmlFor="pref-occupancy" className="font-semibold cursor-pointer flex-1">Lowest Occupancy %</Label>
            </div>
          </RadioGroup>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 space-y-5">
        <div>
          <Label className="text-sm font-bold text-gray-900 mb-2 block">Default Campus</Label>
          <Input
            value="Florida Gulf Coast University (FGCU)"
            disabled
            readOnly
            className="h-12 rounded-xl bg-gray-50 border-gray-100 text-gray-600 font-medium"
            data-testid="input-campus-readonly"
          />
        </div>

        <div>
          <Label className="text-sm font-bold text-gray-900 mb-2 block">Distance Units</Label>
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button
              onClick={() => handleUpdate({ distanceUnits: 'miles' })}
              data-testid="button-unit-miles"
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                profile.preferences.distanceUnits === 'miles' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Miles
            </button>
            <button
              onClick={() => handleUpdate({ distanceUnits: 'kilometers' })}
              data-testid="button-unit-km"
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                profile.preferences.distanceUnits === 'kilometers' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Kilometers
            </button>
          </div>
        </div>

        <div>
          <ToggleRow
            label="Auto-Use Location"
            description="Automatically show nearest garages on start."
            checked={profile.preferences.autoUseLocation}
            onChange={() => handleUpdate({ autoUseLocation: !profile.preferences.autoUseLocation })}
            testId="toggle-auto-location"
            className="px-0 py-2"
          />
        </div>

        <div>
          <Label className="text-sm font-bold text-gray-900 mb-2 block">Favorite Garage</Label>
          <Select
            value={profile.preferences.favoriteGarageId || "none"}
            onValueChange={(val) => handleUpdate({ favoriteGarageId: val === "none" ? null : val })}
          >
            <SelectTrigger className="h-12 rounded-xl border-gray-200" data-testid="select-favorite-garage">
              <SelectValue placeholder="Select a favorite garage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {garages?.map(g => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function NotificationsScreen({ profile }: { profile: UserProfileData }) {
  const queryClient = useQueryClient();
  const updateNotifs = useUpdateNotificationSettings();
  const [savedVisible, setSavedVisible] = useState(false);
  const { toast } = useToast();

  const showSaved = () => {
    setSavedVisible(true);
    setTimeout(() => setSavedVisible(false), 2000);
  };

  const handleToggle = (key: keyof UserProfileData['notifications']) => {
    const newValue = !profile.notifications[key];
    const newNotifs = { ...profile.notifications, [key]: newValue };

    queryClient.setQueryData(getGetUserProfileQueryKey(profile.userId), {
      ...profile,
      notifications: newNotifs
    });

    updateNotifs.mutate({
      userId: profile.userId,
      data: newNotifs
    }, {
      onSuccess: () => showSaved(),
      onError: () => {
        toast({ title: "Error", description: "Failed to save notifications.", variant: "destructive" });
        queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(profile.userId) });
      }
    });
  };

  return (
    <div className="space-y-4 pb-8 animate-in fade-in slide-in-from-right-4 duration-300">
      {savedVisible && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4" data-testid="status-saved-notifications" role="status" aria-live="polite">
          <CheckCircle2 size={18} />
          Saved
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <ToggleRow
          label="Garage Almost Full Alerts"
          description="Get notified when garages near your classes are filling up."
          checked={profile.notifications.garageAlmostFullAlerts}
          onChange={() => handleToggle("garageAlmostFullAlerts")}
          testId="toggle-almost-full"
        />
        <div className="h-px bg-gray-50 mx-4"></div>
        <ToggleRow
          label="Favorite Garage Alerts"
          description="Important updates about your favorite parking spots."
          checked={profile.notifications.favoriteGarageAlerts}
          onChange={() => handleToggle("favoriteGarageAlerts")}
          testId="toggle-favorite-alerts"
        />
        <div className="h-px bg-gray-50 mx-4"></div>
        <ToggleRow
          label="Parking Availability Updates"
          description="Periodic summaries of campus parking."
          checked={profile.notifications.parkingAvailabilityUpdates}
          onChange={() => handleToggle("parkingAvailabilityUpdates")}
          testId="toggle-availability-updates"
        />
        <div className="h-px bg-gray-50 mx-4"></div>
        <ToggleRow
          label="UPARK Announcements"
          description="App updates, new features, and campus news."
          checked={profile.notifications.uparkAnnouncements}
          onChange={() => handleToggle("uparkAnnouncements")}
          testId="toggle-announcements"
        />
        <div className="h-px bg-gray-50 mx-4"></div>
        <ToggleRow
          label="Notification Sound"
          description="Play a sound when alerts arrive."
          checked={profile.notifications.notificationSound}
          onChange={() => handleToggle("notificationSound")}
          testId="toggle-sound"
        />
      </div>
    </div>
  );
}

function ToggleRow({ label, description, checked, onChange, testId, className = "p-4" }: { label: string, description: string, checked: boolean, onChange: () => void, testId: string, className?: string }) {
  return (
    <div className={`${className} flex items-center justify-between gap-4`}>
      <div className="flex-1">
        <Label htmlFor={testId} className="text-base font-bold text-gray-900 block cursor-pointer">{label}</Label>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <Switch id={testId} checked={checked} onCheckedChange={onChange} data-testid={testId} />
    </div>
  );
}

function PrivacyScreen({ profile, viewData }: { profile: UserProfileData, viewData: () => void }) {
  const queryClient = useQueryClient();
  const updatePrefs = useUpdateUserPreferences();
  const clearHistory = useClearUserParkingHistory();
  const deleteAccount = useDeleteUserAccount();
  const { logout } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleToggle = (key: keyof UserProfileData['preferences']) => {
    const newPrefs = { ...profile.preferences, [key]: !profile.preferences[key] };

    queryClient.setQueryData(getGetUserProfileQueryKey(profile.userId), {
      ...profile,
      preferences: newPrefs
    });

    updatePrefs.mutate({
      userId: profile.userId,
      data: newPrefs
    }, {
      onError: () => {
        toast({ title: "Error", description: "Failed to save privacy settings.", variant: "destructive" });
        queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(profile.userId) });
      }
    });
  };

  const handleClearHistory = () => {
    clearHistory.mutate({ userId: profile.userId }, {
      onSuccess: () => {
        toast({ title: "History Cleared", description: "Your parking reports history has been deleted." });
        queryClient.invalidateQueries({ queryKey: getGetUserProfileQueryKey(profile.userId) });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to clear parking history.", variant: "destructive" });
      }
    });
  };

  const handleDeleteAccount = () => {
    deleteAccount.mutate({ userId: profile.userId }, {
      onSuccess: () => {
        logout();
        setLocation("/");
        toast({ title: "Account Deleted", description: "Your data has been removed." });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete account.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 pb-8 animate-in fade-in slide-in-from-right-4 duration-300">

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <ToggleRow
          label="Location Services"
          description="Allow UPARK to access your device location for nearby garages."
          checked={profile.preferences.locationServices}
          onChange={() => handleToggle("locationServices")}
          testId="toggle-location-services"
        />
        <div className="h-px bg-gray-50 mx-4"></div>
        <ToggleRow
          label="Anonymous Data Collection"
          description="Help improve UPARK by sharing anonymous usage stats."
          checked={profile.preferences.anonymousDataCollection}
          onChange={() => handleToggle("anonymousDataCollection")}
          testId="toggle-anonymous-data"
        />
      </div>

      <Button
        variant="outline"
        className="w-full h-14 rounded-2xl font-bold bg-white text-gray-700 shadow-sm gap-2"
        onClick={viewData}
        data-testid="button-view-data"
      >
        <FileText size={20} />
        View My Data
      </Button>

      <div className="bg-red-50 rounded-3xl p-5 border border-red-100 space-y-4">
        <h3 className="font-bold text-red-900 flex items-center gap-2">
          <AlertTriangle size={20} />
          Danger Zone
        </h3>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full bg-white border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl font-bold" data-testid="button-clear-history">
              <History className="mr-2" size={18} /> Clear Parking History
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl border-0 shadow-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-black">Clear History?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete all your past parking reports and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-bold border-gray-200" data-testid="button-cancel-clear-history">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearHistory} className="rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white border-0" data-testid="confirm-clear-history">
                Yes, clear history
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-full rounded-xl font-bold" data-testid="button-delete-account">
              <Trash2 className="mr-2" size={18} /> Delete Account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl border-0 shadow-lg">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-black">Delete Account?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove your profile, preferences, and all associated data from our servers. You will be signed out immediately.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl font-bold border-gray-200" data-testid="button-cancel-delete-account">Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAccount} className="rounded-xl font-bold bg-red-500 hover:bg-red-600 text-white border-0" data-testid="confirm-delete-account">
                Delete everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

    </div>
  );
}

function DataScreen({ profile, goBack }: { profile: UserProfileData, goBack: () => void }) {
  const { data: garages } = useListGarages();

  return (
    <div className="space-y-6 pb-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <Button variant="ghost" onClick={goBack} className="mb-2 -ml-3 text-gray-500 gap-1 font-bold">
        <ChevronLeft size={20} /> Back to Privacy
      </Button>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-4 border-b border-gray-100 pb-3">Profile Snapshot</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500 font-semibold">User ID</dt>
            <dd className="font-mono bg-gray-50 px-2 py-0.5 rounded text-gray-700" data-testid="data-userid">{profile.userId}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500 font-semibold">Name</dt>
            <dd className="font-bold text-gray-900" data-testid="data-username">{profile.displayName}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-4 border-b border-gray-100 pb-3">Saved Preferences</h3>
        <pre className="text-xs bg-gray-50 p-4 rounded-2xl overflow-x-auto text-gray-700 font-mono border border-gray-100" data-testid="data-preferences-json">
          {JSON.stringify(profile.preferences, null, 2)}
        </pre>
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-4 border-b border-gray-100 pb-3 flex justify-between items-center">
          Favorite Garages
          <Badge variant="secondary" className="rounded-full bg-blue-50 text-primary">{profile.favoriteGarageIds.length}</Badge>
        </h3>
        {profile.favoriteGarageIds.length > 0 ? (
          <ul className="space-y-2" data-testid="data-favorites-list">
            {profile.favoriteGarageIds.map(id => {
              const garage = garages?.find(g => g.id === id);
              return (
                <li key={id} className="text-sm bg-gray-50 px-3 py-2 rounded-xl text-gray-700 border border-gray-100">
                  <span className="font-bold block">{garage ? garage.name : "Unknown Garage"}</span>
                  <span className="font-mono text-xs text-gray-500">{id}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">No favorites saved.</p>
        )}
      </div>

      <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-4 border-b border-gray-100 pb-3 flex justify-between items-center">
          Parking Reports
          <Badge variant="secondary" className="rounded-full bg-blue-50 text-primary">{profile.parkingReports.length}</Badge>
        </h3>
        {profile.parkingReports.length > 0 ? (
          <div className="space-y-3" data-testid="data-reports-list">
            {profile.parkingReports.map(report => {
              const garage = garages?.find(g => g.id === report.garageId);
              return (
                <div key={report.id} className="text-sm bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-gray-900">{report.availabilityStatus}</span>
                    <span className="text-xs text-gray-500">{new Date(report.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-xs text-gray-600 font-medium">Garage: {garage ? garage.name : report.garageId}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No reports submitted.</p>
        )}
      </div>
    </div>
  );
}

function SupportScreen({ profile }: { profile: UserProfileData }) {
  const [formOpen, setFormOpen] = useState(false);
  const [category, setCategory] = useState("problem");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const submitSupport = useCreateSupportRequest();
  const { toast } = useToast();

  const isValid = subject.trim().length >= 3 && message.trim().length >= 10;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    submitSupport.mutate({
      userId: profile.userId,
      data: { category, subject, message }
    }, {
      onSuccess: () => {
        toast({ title: "Message Sent", description: "Thanks for reaching out! We'll look into it." });
        setFormOpen(false);
        setSubject("");
        setMessage("");
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6 pb-8 animate-in fade-in slide-in-from-right-4 duration-300">

      {!formOpen && (
        <>
          <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-xl font-black text-gray-900 mb-4">Frequently Asked Questions</h3>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1" className="border-b border-gray-100">
                <AccordionTrigger className="text-left font-bold text-gray-800 hover:no-underline hover:text-primary">How UPARK Works</AccordionTrigger>
                <AccordionContent className="text-gray-600 leading-relaxed">
                  UPARK uses a combination of official FGCU data and crowdsourced reports from students to estimate how full garages are. When you arrive at a garage, you can submit a quick report to help others find spots.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="border-0">
                <AccordionTrigger className="text-left font-bold text-gray-800 hover:no-underline hover:text-primary">How Parking Availability Works</AccordionTrigger>
                <AccordionContent className="text-gray-600 leading-relaxed">
                  The percentage you see represents our best estimate of occupancy. A garage marked as "Filling Up" means spots are becoming scarce, while "Full" means you should likely look elsewhere. Reports expire over time to keep data fresh.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Button
              variant="outline"
              className="h-16 rounded-2xl justify-start px-5 font-bold text-gray-700 bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              onClick={() => { setCategory("problem"); setFormOpen(true); }}
              data-testid="button-report-problem"
            >
              <AlertTriangle className="mr-3 text-orange-500" size={20} />
              Report a Problem
            </Button>
            <Button
              variant="outline"
              className="h-16 rounded-2xl justify-start px-5 font-bold text-gray-700 bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              onClick={() => { setCategory("feedback"); setFormOpen(true); }}
              data-testid="button-send-feedback"
            >
              <FileText className="mr-3 text-blue-500" size={20} />
              Send Feedback
            </Button>
            <Button
              variant="outline"
              className="h-16 rounded-2xl justify-start px-5 font-bold text-gray-700 bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300"
              onClick={() => { setCategory("support"); setFormOpen(true); }}
              data-testid="button-contact-support"
            >
              <CircleHelp className="mr-3 text-green-500" size={20} />
              Contact Support
            </Button>
          </div>
        </>
      )}

      {formOpen && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 animate-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-black text-gray-900 capitalize">
              {category === "problem" ? "Report Problem" : category === "feedback" ? "Send Feedback" : "Contact Support"}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)} className="rounded-xl h-8 px-3 font-bold text-gray-500 hover:bg-gray-100" data-testid="button-cancel-support">
              Cancel
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label className="text-sm font-bold text-gray-900 mb-2 block">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 rounded-xl bg-gray-50 border-gray-100 focus-visible:ring-primary focus-visible:bg-white" data-testid="select-support-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="problem">Report a Problem</SelectItem>
                  <SelectItem value="feedback">Send Feedback</SelectItem>
                  <SelectItem value="support">Contact Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-bold text-gray-900 mb-2 block">Subject</Label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Brief description"
                className="h-12 rounded-xl bg-gray-50 border-gray-100 focus-visible:ring-primary focus-visible:bg-white"
                data-testid="input-support-subject"
                required
              />
            </div>
            <div>
              <Label className="text-sm font-bold text-gray-900 mb-2 block">Message</Label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Please describe in detail..."
                className="min-h-[120px] rounded-xl bg-gray-50 border-gray-100 focus-visible:ring-primary focus-visible:bg-white resize-none"
                data-testid="input-support-message"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-14 rounded-2xl font-bold text-base shadow-md gap-2 mt-2 hover-elevate"
              disabled={submitSupport.isPending || !isValid}
              data-testid="button-submit-support"
            >
              {submitSupport.isPending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              Send Message
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
