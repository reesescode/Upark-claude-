import { useState, useEffect } from 'react';

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('upark_favorites');
      if (stored) setFavorites(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to load favorites', e);
    }
  }, []);

  const saveFavorites = (newFavs: string[]) => {
    setFavorites(newFavs);
    localStorage.setItem('upark_favorites', JSON.stringify(newFavs));
  };

  const toggleFavorite = (id: string) => {
    if (favorites.includes(id)) {
      saveFavorites(favorites.filter(fav => fav !== id));
    } else {
      saveFavorites([...favorites, id]);
    }
  };

  const isFavorite = (id: string) => favorites.includes(id);

  return { favorites, toggleFavorite, isFavorite };
}

export function useUser() {
  const [user, setUser] = useState<{name: string, studentId: string} | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('upark_user');
      if (stored) setUser(JSON.parse(stored));
    } catch (e) {
      console.error('Failed to load user', e);
    }
  }, []);

  const login = (name: string, studentId: string) => {
    const u = { name, studentId };
    setUser(u);
    localStorage.setItem('upark_user', JSON.stringify(u));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('upark_user');
  };

  return { user, login, logout };
}
