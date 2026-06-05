// lib/redis.ts
import { Redis } from '@upstash/redis';
import { AnimeSeries, PendingEpisode } from '@/types';
import { SEED_SERIES } from '@/lib/seed-data';
import { getLiveCatalog } from '@/lib/live-catalog';

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

const fallbackSeriesStore = new Map<string, AnimeSeries>(SEED_SERIES.map((series) => [series.id, series]));
const fallbackPendingEpisodes: PendingEpisode[] = [];

export function getRedisIfConfigured(): Redis | null {
  if (
    !REDIS_URL ||
    REDIS_URL === 'your_redis_url' ||
    !REDIS_TOKEN ||
    REDIS_TOKEN === 'your_redis_token'
  ) {
    return null;
  }
  return Redis.fromEnv();
}

export function getRedis() {
  const redis = getRedisIfConfigured();
  if (!redis) {
    throw new Error(
      'Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.'
    );
  }
  return redis;
}

export const KEYS = {
  series: (id: string) => `series:${id}`,
  seriesList: 'series:list',
  pendingEpisodes: (seriesId: string) => `pending:${seriesId}`,
  pendingList: 'pending:all',
  syncLogs: 'sync:logs',
  lastSync: 'sync:last',
  approvedSources: 'config:approvedSources',
  manualSeries: 'manual:list',
};

export async function getAllSeries(): Promise<AnimeSeries[]> {
  const redis = getRedisIfConfigured();
  if (!redis) {
    return getLiveCatalog();
  }

  const seriesIds = await redis.smembers(KEYS.seriesList);
  const series = await Promise.all(
    seriesIds.map(async (id) => {
      const data = await redis.get(KEYS.series(id));
      return data as AnimeSeries | null;
    })
  );
  return series.filter((s): s is AnimeSeries => s !== null);
}

export async function getSeries(id: string): Promise<AnimeSeries | null> {
  const redis = getRedisIfConfigured();
  if (!redis) {
    const catalog = await getLiveCatalog();
    return catalog.find((series) => series.id === id) ?? fallbackSeriesStore.get(id) ?? null;
  }

  return (await redis.get<AnimeSeries>(KEYS.series(id))) ?? null;
}

export async function saveSeries(series: AnimeSeries) {
  const redis = getRedisIfConfigured();
  if (!redis) {
    fallbackSeriesStore.set(series.id, series);
    return;
  }

  await redis.set(KEYS.series(series.id), series);
  await redis.sadd(KEYS.seriesList, series.id);
}

export async function addPendingEpisode(seriesId: string, episode: Omit<PendingEpisode, 'id' | 'detectedAt' | 'status'>) {
  const redis = getRedisIfConfigured();
  const id = `${seriesId}:ep${episode.episodeNumber}:${Date.now()}`;
  const pending: PendingEpisode = {
    ...episode,
    id,
    seriesId,
    detectedAt: new Date().toISOString(),
    status: 'pending',
  };

  if (!redis) {
    fallbackPendingEpisodes.unshift(pending);
    return pending;
  }

  await redis.lpush(KEYS.pendingEpisodes(seriesId), JSON.stringify(pending));
  await redis.sadd(KEYS.pendingList, id);
  return pending;
}

export async function getPendingEpisodes(seriesId?: string): Promise<PendingEpisode[]> {
  const redis = getRedisIfConfigured();
  if (!redis) {
    return seriesId
      ? fallbackPendingEpisodes.filter((episode) => episode.seriesId === seriesId)
      : [...fallbackPendingEpisodes];
  }

  if (seriesId) {
    const items = await redis.lrange(KEYS.pendingEpisodes(seriesId), 0, -1);
    return items.map((item) => JSON.parse(item as string));
  } else {
    const ids = await redis.smembers(KEYS.pendingList);
    const episodes = await Promise.all(
      ids.map(async (id) => {
        const sid = (id as string).split(':')[0];
        const items = await redis.lrange(KEYS.pendingEpisodes(sid), 0, -1);
        return items.map((i) => JSON.parse(i as string)).find((e: PendingEpisode) => e.id === id);
      })
    );
    return episodes.filter((e): e is PendingEpisode => e !== undefined);
  }
}

export async function removePendingEpisode(episode: PendingEpisode) {
  const redis = getRedisIfConfigured();
  if (!redis) {
    const index = fallbackPendingEpisodes.findIndex((item) => item.id === episode.id);
    if (index >= 0) {
      fallbackPendingEpisodes.splice(index, 1);
    }
    return;
  }

  await redis.lrem(KEYS.pendingEpisodes(episode.seriesId), 0, JSON.stringify(episode));
  await redis.srem(KEYS.pendingList, episode.id);
}

export async function getAdminInfo() {
  const redis = getRedisIfConfigured();
  if (!redis) {
    return { logs: [], lastSync: null };
  }

  const logsRaw = await redis.lrange(KEYS.syncLogs, 0, 49);
  const logs = logsRaw.map((log) => {
    try {
      return JSON.parse(log as string);
    } catch {
      return log;
    }
  });
  const lastSync = await redis.get(KEYS.lastSync);
  return { logs, lastSync };
}

export async function appendSyncLog(message: string) {
  const redis = getRedisIfConfigured();
  if (!redis) return;
  const entry = JSON.stringify({ time: new Date().toISOString(), message });
  await redis.lpush(KEYS.syncLogs, entry);
  await redis.ltrim(KEYS.syncLogs, 0, 49);
  await redis.set(KEYS.lastSync, new Date().toISOString());
}
