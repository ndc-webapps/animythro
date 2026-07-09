import type { AnimeSeries } from '@/types';
import {
  buildCatalogFromSnapshot,
  countCatalogEpisodes,
  STATIC_CATALOG,
  type CatalogSnapshot,
} from './static-catalog';

export interface CatalogSyncState {
  status: 'idle' | 'syncing' | 'ok' | 'error';
  lastCheckedAt: string | null;
  lastUpdatedAt: string | null;
  lastAutoSyncDate: string | null;
  source: string;
  titleCount: number;
  episodeCount: number;
  message: string | null;
}

export const CATALOG_SYNC_STORAGE_KEY = 'animythro_catalog_sync';

export const DEFAULT_CATALOG_SYNC_STATE: CatalogSyncState = {
  status: 'idle',
  lastCheckedAt: null,
  lastUpdatedAt: null,
  lastAutoSyncDate: null,
  source: 'bundled',
  titleCount: STATIC_CATALOG.length,
  episodeCount: countCatalogEpisodes(STATIC_CATALOG),
  message: null,
};

const DB_NAME = 'animythro_catalog';
const DB_VERSION = 1;
const STORE_NAME = 'snapshots';
const SNAPSHOT_KEY = 'latest';
const REPO = 'ndc-webapps/animythro';
const REMOTE_REFS = ['catalog-sync/auto', 'main'];

interface CachedSnapshot {
  snapshot: CatalogSnapshot;
  source: string;
  fetchedAt: string;
}

function openCatalogDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openCatalogDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbSet<T>(key: string, value: T): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openCatalogDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

async function fetchGitHubJson<T>(path: string, ref: string): Promise<T> {
  const url = `https://raw.githubusercontent.com/${REPO}/${ref}/${path}`;
  const response = await fetch(url, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`${path} ${response.status}`);
  return await response.json() as T;
}

async function fetchRemoteSnapshot() {
  let lastError: unknown = null;

  for (const ref of REMOTE_REFS) {
    try {
      const [expandedCatalog, expandedPlaylists] = await Promise.all([
        fetchGitHubJson<CatalogSnapshot['expandedCatalog']>('lib/expanded-catalog.json', ref),
        fetchGitHubJson<CatalogSnapshot['expandedPlaylists']>('lib/expanded-playlists.json', ref),
      ]);
      return {
        snapshot: { expandedCatalog, expandedPlaylists },
        source: `github:${ref}`,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('GitHub catalog sync failed');
}

export async function loadCachedCatalog(): Promise<{ catalog: AnimeSeries[]; state: Partial<CatalogSyncState> } | null> {
  const cached = await idbGet<CachedSnapshot>(SNAPSHOT_KEY);
  if (!cached) return null;
  const catalog = buildCatalogFromSnapshot(cached.snapshot);
  return {
    catalog,
    state: {
      source: cached.source,
      lastUpdatedAt: cached.fetchedAt,
      titleCount: catalog.length,
      episodeCount: countCatalogEpisodes(catalog),
    },
  };
}

export async function syncCatalogFromGitHub(): Promise<{ catalog: AnimeSeries[]; state: Partial<CatalogSyncState> }> {
  const remote = await fetchRemoteSnapshot();
  const catalog = buildCatalogFromSnapshot(remote.snapshot);
  const fetchedAt = new Date().toISOString();

  await idbSet<CachedSnapshot>(SNAPSHOT_KEY, {
    snapshot: remote.snapshot,
    source: remote.source,
    fetchedAt,
  });

  return {
    catalog,
    state: {
      status: 'ok',
      source: remote.source,
      lastCheckedAt: fetchedAt,
      lastUpdatedAt: fetchedAt,
      titleCount: catalog.length,
      episodeCount: countCatalogEpisodes(catalog),
      message: 'Catalog synced',
    },
  };
}

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function shouldAutoSync(lastAutoSyncDate: string | null, date = new Date()) {
  return date.getHours() >= 8 && lastAutoSyncDate !== localDateKey(date);
}
