import { useState, useEffect } from 'react';
import {
  getGetUserProfileQueryKey,
  updateUserFavorites,
  useGetUserProfile,
  type UserProfileData,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useClerk, useUser as useClerkUser } from '@clerk/react';

const favoriteUpdateQueues = new Map<string, Promise<string[]>>();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function getFavoritesStorageKey(userId?: string) {
  return userId ? `upark_favorites_${userId}` : 'upark_favorites_guest';
}

function readFavorites(key: string): string[] {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function publishFavorites(key: string, favorites: string[]) {
  localStorage.setItem(key, JSON.stringify(favorites));
  window.dispatchEvent(
    new CustomEvent('upark:favorites', { detail: { key, favorites } }),
  );
}

export function useUser() {
  const { user: clerkUser, isLoaded } = useClerkUser();
  const { signOut } = useClerk();
  const user = clerkUser ? {
    name: clerkUser.fullName || clerkUser.firstName || 'Student',
    studentId: clerkUser.id,
    email: clerkUser.primaryEmailAddress?.emailAddress || '',
  } : null;
  const logout = async () => {
    if (user?.studentId) localStorage.removeItem(getFavoritesStorageKey(user.studentId));
    localStorage.removeItem('upark_user');
    localStorage.removeItem('upark_favorites');
    await signOut({ redirectUrl: basePath || '/' });
  };
  return { user, logout, isLoaded };
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const { user } = useUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const storageKey = getFavoritesStorageKey(user?.studentId);

  useEffect(() => {
    const legacyFavorites = localStorage.getItem('upark_favorites');
    if (
      user?.studentId &&
      localStorage.getItem(storageKey) === null &&
      legacyFavorites
    ) {
      localStorage.setItem(storageKey, legacyFavorites);
      localStorage.removeItem('upark_favorites');
    }
    setFavorites(readFavorites(storageKey));

    const onFavorites = (event: Event) => {
      const detail = (event as CustomEvent<{
        key: string;
        favorites: string[];
      }>).detail;
      if (detail.key === storageKey) setFavorites(detail.favorites);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setFavorites(readFavorites(storageKey));
    };
    window.addEventListener('upark:favorites', onFavorites);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('upark:favorites', onFavorites);
      window.removeEventListener('storage', onStorage);
    };
  }, [storageKey, user?.studentId]);

  const { data: profile } = useGetUserProfile(user?.studentId || '', {
    query: {
      enabled: !!user?.studentId,
      queryKey: getGetUserProfileQueryKey(user?.studentId || ''),
      retry: false,
    }
  });

  useEffect(() => {
    if (profile?.favoriteGarageIds) {
      publishFavorites(storageKey, profile.favoriteGarageIds);
    }
  }, [profile?.favoriteGarageIds, storageKey]);

  const saveFavorites = (newFavs: string[]) => {
    const previousFavorites = readFavorites(storageKey);
    publishFavorites(storageKey, newFavs);

    if (user?.studentId) {
      const userId = user.studentId;
      const queued = (favoriteUpdateQueues.get(userId) ?? Promise.resolve([]))
        .catch(() => [])
        .then(() => updateUserFavorites(userId, { garageIds: newFavs }))
        .then((updatedFavorites) => {
          publishFavorites(storageKey, updatedFavorites);
          queryClient.setQueryData(
            getGetUserProfileQueryKey(userId),
            (old: UserProfileData | undefined) =>
              old ? { ...old, favoriteGarageIds: updatedFavorites } : old,
          );
          return updatedFavorites;
        })
        .catch(() => {
          publishFavorites(storageKey, previousFavorites);
          toast({
            title: 'Favorite not saved',
            description: 'Please check your connection and try again.',
            variant: 'destructive',
          });
          return previousFavorites;
        });
      favoriteUpdateQueues.set(userId, queued);
    }
  };

  const toggleFavorite = (id: string) => {
    const currentFavorites = readFavorites(storageKey);
    if (currentFavorites.includes(id)) {
      saveFavorites(currentFavorites.filter(fav => fav !== id));
    } else {
      saveFavorites([...currentFavorites, id]);
    }
  };

  const isFavorite = (id: string) => favorites.includes(id);

  return { favorites, toggleFavorite, isFavorite };
}
