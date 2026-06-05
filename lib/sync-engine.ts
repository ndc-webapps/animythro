// lib/sync-engine.ts
import { getRedis, KEYS } from './redis';
import { getPlaylistItems, extractEpisodeNumber, generateEmbedUrl } from './youtube';
import { APPROVED_SOURCES } from './seed-data';
import { AnimeSeries, Episode } from '@/types';

export async function syncAllSeries(apiKey: string, reviewBeforePublish: boolean = true): Promise<{
  synced: number;
  newEpisodes: number;
  errors: string[];
}> {
  const logs: string[] = [];
  let newEpisodesCount = 0;
  let syncedCount = 0;
  const errors: string[] = [];

  const log = (message: string) => {
    console.log(message);
    logs.push(`[${new Date().toISOString()}] ${message}`);
  };

  log('Starting sync process...');

  const redis = getRedis();

  for (const source of APPROVED_SOURCES) {
    for (const playlistConfig of source.approvedPlaylists) {
      try {
        log(`Syncing playlist: ${playlistConfig.playlistId} for anime: ${playlistConfig.animeId}`);
        
        const playlistItems = await getPlaylistItems(playlistConfig.playlistId, apiKey);
        if (playlistItems.length === 0) {
          log(`No items found in playlist ${playlistConfig.playlistId}`);
          continue;
        }

        const series = await redis.get(KEYS.series(playlistConfig.animeId)) as AnimeSeries | null;
        if (!series) {
          log(`Series ${playlistConfig.animeId} not found in database`);
          continue;
        }

        const existingEpisodes = series.episodes || [];
        const existingEpisodeNumbers = new Set(existingEpisodes.map(ep => ep.episodeNumber));
        
        const newEpisodes: Episode[] = [];

        for (const item of playlistItems) {
          const episodeNum = extractEpisodeNumber(item.title, playlistConfig.episodeRegex);
          if (!episodeNum) continue;

          if (!existingEpisodeNumbers.has(episodeNum)) {
            const newEpisode: Episode = {
              episodeNumber: episodeNum,
              title: item.title,
              embedUrl: generateEmbedUrl(item.videoId),
              sourceVideoId: item.videoId,
              sourceName: source.sourceName,
              uploadDate: item.publishedAt,
              isEmbeddable: true,
              legalStatus: 'official_embed',
              isNew: true,
              thumbnail: item.thumbnail,
            };

            newEpisodes.push(newEpisode);
          }
        }

        if (newEpisodes.length > 0) {
          log(`Found ${newEpisodes.length} new episodes for ${series.title}`);
          
          if (reviewBeforePublish && playlistConfig.reviewBeforePublish) {
            for (const episode of newEpisodes) {
              await redis.lpush(
                KEYS.pendingEpisodes(series.id),
                JSON.stringify({
                  ...episode,
                  id: `${series.id}:${episode.episodeNumber}:${Date.now()}`,
                  seriesId: series.id,
                  detectedAt: new Date().toISOString(),
                  status: 'pending',
                })
              );
              await redis.sadd(KEYS.pendingList, `${series.id}:${episode.episodeNumber}`);
              log(`Added episode ${episode.episodeNumber} to pending review`);
            }
            newEpisodesCount += newEpisodes.length;
          } else {
            const updatedEpisodes = [...existingEpisodes, ...newEpisodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
            series.episodes = updatedEpisodes;
            series.totalEpisodes = updatedEpisodes.length;
            series.latestEpisode = Math.max(...updatedEpisodes.map(e => e.episodeNumber));
            series.lastSync = new Date().toISOString();
            await redis.set(KEYS.series(series.id), series);
            newEpisodesCount += newEpisodes.length;
            log(`Added ${newEpisodes.length} episodes directly to series`);
          }
          syncedCount++;
        } else {
          log(`No new episodes found for ${series.title}`);
        }
      } catch (error) {
        const errorMsg = `Error syncing playlist ${playlistConfig.playlistId}: ${error}`;
        log(errorMsg);
        errors.push(errorMsg);
      }
    }
  }

  await redis.lpush(KEYS.syncLogs, JSON.stringify({
    timestamp: new Date().toISOString(),
    synced: syncedCount,
    newEpisodes: newEpisodesCount,
    errors,
    logs: logs.slice(-50),
  }));

  await redis.set(KEYS.lastSync, new Date().toISOString());

  log(`Sync completed. Synced ${syncedCount} series, found ${newEpisodesCount} new episodes.`);
  
  return { synced: syncedCount, newEpisodes: newEpisodesCount, errors };
}