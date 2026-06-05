// components/providers/AppProvider.tsx
'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { WatchHistory } from '@/types';

interface AppContextType {
  watchlist: string[];
  addToWatchlist: (id: string) => void;
  removeFromWatchlist: (id: string) => void;
  isInWatchlist: (id: string) => boolean;
  continueWatching: WatchHistory[];
  updateContinueWatching: (history: WatchHistory) => void;
  getEpisodeProgress: (animeId: string, episodeNumber: number) => WatchHistory | null;
  getLastWatchedEpisode: (animeId: string) => WatchHistory | null;
  watchHistory: WatchHistory[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedGenres: string[];
  toggleGenre: (genre: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  watchlist: 'animythro_watchlist',
  continue: 'animythro_continue',
  history: 'animythro_history',
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchHistory[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setWatchlist(safeRead<string[]>(STORAGE_KEYS.watchlist, []));
    setContinueWatching(safeRead<WatchHistory[]>(STORAGE_KEYS.continue, []));
    setWatchHistory(safeRead<WatchHistory[]>(STORAGE_KEYS.history, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(watchlist));
  }, [watchlist, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.continue, JSON.stringify(continueWatching));
  }, [continueWatching, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(watchHistory));
  }, [watchHistory, hydrated]);

  const addToWatchlist = (id: string) => {
    setWatchlist((prev) => prev.includes(id) ? prev : [...prev, id]);
  };

  const removeFromWatchlist = (id: string) => {
    setWatchlist((prev) => prev.filter((item) => item !== id));
  };

  const isInWatchlist = (id: string) => watchlist.includes(id);

  const updateContinueWatching = useCallback((history: WatchHistory) => {
    setContinueWatching((current) => {
      const filtered = current.filter(
        (h) => !(h.animeId === history.animeId && h.episodeNumber === history.episodeNumber)
      );
      return [history, ...filtered].slice(0, 20);
    });

    setWatchHistory((current) => {
      const idx = current.findIndex(
        (h) => h.animeId === history.animeId && h.episodeNumber === history.episodeNumber
      );
      if (idx === -1) return [history, ...current].slice(0, 100);
      const updated = [...current];
      updated[idx] = history;
      return updated;
    });
  }, []);

  const getEpisodeProgress = useCallback(
    (animeId: string, episodeNumber: number): WatchHistory | null => {
      return (
        watchHistory.find(
          (h) => h.animeId === animeId && h.episodeNumber === episodeNumber
        ) ?? null
      );
    },
    [watchHistory]
  );

  const getLastWatchedEpisode = useCallback(
    (animeId: string): WatchHistory | null => {
      const entries = watchHistory
        .filter((h) => h.animeId === animeId)
        .sort((a, b) => b.timestamp - a.timestamp);
      return entries[0] ?? null;
    },
    [watchHistory]
  );

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  return (
    <AppContext.Provider
      value={{
        watchlist,
        addToWatchlist,
        removeFromWatchlist,
        isInWatchlist,
        continueWatching,
        updateContinueWatching,
        getEpisodeProgress,
        getLastWatchedEpisode,
        watchHistory,
        searchQuery,
        setSearchQuery,
        selectedGenres,
        toggleGenre,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
