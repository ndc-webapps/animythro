// components/providers/AppProvider.tsx
'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AnimeSeries, WatchHistory } from '@/types';
import {
  CATALOG_SYNC_STORAGE_KEY,
  DEFAULT_CATALOG_SYNC_STATE,
  loadCachedCatalog,
  localDateKey,
  shouldAutoSync,
  syncCatalogFromGitHub,
  type CatalogSyncState,
} from '@/lib/catalog-sync';
import { STATIC_CATALOG } from '@/lib/static-catalog';

interface AppContextType {
  catalog: AnimeSeries[];
  catalogLoading: boolean;
  catalogError: string | null;
  catalogSync: CatalogSyncState;
  refreshCatalog: (manual?: boolean) => Promise<void>;
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
  const [catalog, setCatalog] = useState<AnimeSeries[]>(STATIC_CATALOG);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSync, setCatalogSync] = useState<CatalogSyncState>(DEFAULT_CATALOG_SYNC_STATE);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [continueWatching, setContinueWatching] = useState<WatchHistory[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const refreshCatalog = useCallback(async (manual = false) => {
    const startedAt = new Date().toISOString();
    const today = localDateKey();

    setCatalogError(null);
    setCatalogSync((current) => ({
      ...current,
      status: 'syncing',
      lastCheckedAt: startedAt,
      lastAutoSyncDate: manual ? current.lastAutoSyncDate : today,
      message: manual ? 'Manual sync running' : 'Daily sync running',
    }));

    try {
      const result = await syncCatalogFromGitHub();
      setCatalog(result.catalog);
      setCatalogSync((current) => ({
        ...current,
        ...result.state,
        lastAutoSyncDate: manual ? current.lastAutoSyncDate : today,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Catalog sync failed';
      setCatalogSync((current) => ({
        ...current,
        status: 'error',
        lastCheckedAt: new Date().toISOString(),
        lastAutoSyncDate: manual ? current.lastAutoSyncDate : today,
        message,
      }));
    }
  }, []);

  useEffect(() => {
    setWatchlist(safeRead<string[]>(STORAGE_KEYS.watchlist, []));
    setContinueWatching(safeRead<WatchHistory[]>(STORAGE_KEYS.continue, []));
    setWatchHistory(safeRead<WatchHistory[]>(STORAGE_KEYS.history, []));
    const storedSync = safeRead<CatalogSyncState>(
      CATALOG_SYNC_STORAGE_KEY,
      DEFAULT_CATALOG_SYNC_STATE
    );
    setCatalogSync(storedSync);
    setHydrated(true);

    let active = true;
    loadCachedCatalog()
      .then((cached) => {
        if (!active || !cached) return;
        setCatalog(cached.catalog);
        setCatalogSync((current) => ({ ...current, ...cached.state }));
      })
      .catch((error) => {
        if (!active) return;
        setCatalogSync((current) => ({
          ...current,
          message: error instanceof Error ? error.message : 'Catalog cache failed',
        }));
      })
      .finally(() => {
        if (!active) return;
        setCatalogLoading(false);
        if (shouldAutoSync(storedSync.lastAutoSyncDate)) {
          void refreshCatalog(false);
        }
      });

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setCatalogSync((current) => {
          if (shouldAutoSync(current.lastAutoSyncDate)) {
            void refreshCatalog(false);
          }
          return current;
        });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
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

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(CATALOG_SYNC_STORAGE_KEY, JSON.stringify(catalogSync));
  }, [catalogSync, hydrated]);

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
        catalog,
        catalogLoading,
        catalogError,
        catalogSync,
        refreshCatalog,
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
