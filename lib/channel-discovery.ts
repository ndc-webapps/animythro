// lib/channel-discovery.ts
// Channel-level anime discovery engine.
//
// How it works:
//  1. For each official channel → fetch all playlists via YouTube API.
//  2. Filter playlists: anime content only, no trailers/shorts/promos.
//  3. For each new (unseen) playlist → fetch its video IDs.
//  4. Check embeddability (videos.list) — only keep embeddable videos.
//  5. Compare with existing catalog (Redis + expanded-catalog.json).
//  6. Auto-add entries where all videos are confirmed embeddable.
//     Entries with mixed embeddability → put in pending queue.
//  7. Deduplicate by video ID, by playlist ID, and by title+episode.
//  8. Store discovered playlist IDs in Redis so re-runs skip them.
//
// Quota budget per full run (10,000 units/day):
//   • playlists.list  : ~10 pages/channel × 9 channels = ~90 units
//   • playlistItems   : max MAX_NEW_PLAYLISTS_PER_RUN playlists × ~2 pages = ~40 units
//   • videos.list     : max 20 batches of 50 = ~20 units
//   Total typical run: < 200 units

import { getRedis, KEYS } from './redis';
import {
  getChannelPlaylists,
  getPlaylistItems,
  checkEmbeddability,
  extractEpisodeNumber,
  generateEmbedUrl,
  YouTubePlaylist,
  YouTubePlaylistItem,
} from './youtube';
import {
  OFFICIAL_ANIME_CHANNELS,
  EXCLUDE_PATTERNS,
  STRICT_PATTERNS,
  MIN_EPISODE_SECONDS,
  type OfficialChannel,
} from './channel-sources';
import type { AnimeSeries, Episode } from '@/types';

// Safety cap: only process this many NEW playlists per sync run to stay within quota.
const MAX_NEW_PLAYLISTS_PER_RUN = 20;

/* ── Result types ───────────────────────────────────────────────────── */

export interface DiscoverySummary {
  channelsChecked: number;
  playlistsFound: number;
  playlistsNew: number;
  playlistsSkipped: number;   // already indexed or filtered out
  animeTitlesAdded: number;
  episodesAdded: number;
  pendingReview: number;
  duplicatesSkipped: number;
  invalidSkipped: number;     // private / non-embeddable
  errors: string[];
  details: ChannelResult[];
}

export interface ChannelResult {
  channelId: string;
  channelName: string;
  playlistsFound: number;
  newPlaylists: number;
  added: number;
  pending: number;
  errors: string[];
}

/* ── Content filtering ──────────────────────────────────────────────── */

function isAnimePlaylist(playlist: YouTubePlaylist, strict: boolean): boolean {
  const t = playlist.title;
  // Must have at least 1 video
  if (playlist.itemCount < 1) return false;
  // Exclude bad content
  if (EXCLUDE_PATTERNS.test(t)) return false;
  // Strict channels: only accept playlists that look like episode lists / full series
  if (strict && !STRICT_PATTERNS.test(t)) return false;
  return true;
}

function isAnimeVideo(title: string): boolean {
  return !EXCLUDE_PATTERNS.test(title);
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/【[^】]*】/g, ' ')
    .replace(/\[[^\]]*(?:English Sub|English Dub|Eng Sub|Eng Dub|JP Dub)[^\]]*\]/gi, ' ')
    .replace(/\s*\|\s*.+$/, ' ')
    .replace(/《([^》]+)》.*/s, '$1')   // keep the first 《...》 block if present
    .replace(/[《》【】（）]/g, ' ')
    .replace(/\bULTRA\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'anime';
}

/* ── Redis key for tracking which playlists we have already indexed ── */
const INDEXED_PLAYLISTS_KEY = 'discovery:indexed_playlists';
const INDEXED_VIDEO_IDS_KEY = 'discovery:indexed_video_ids';

/* ── Main discovery function ────────────────────────────────────────── */

export async function discoverFromChannels(
  apiKey: string,
  options: {
    channels?: string[];           // optional: only check these channel IDs
    reviewBeforePublish?: boolean; // default true
    maxNewPlaylists?: number;      // override MAX_NEW_PLAYLISTS_PER_RUN
  } = {}
): Promise<DiscoverySummary> {
  const {
    reviewBeforePublish = true,
    maxNewPlaylists = MAX_NEW_PLAYLISTS_PER_RUN,
  } = options;

  const channelFilter = options.channels ? new Set(options.channels) : null;

  const summary: DiscoverySummary = {
    channelsChecked: 0,
    playlistsFound: 0,
    playlistsNew: 0,
    playlistsSkipped: 0,
    animeTitlesAdded: 0,
    episodesAdded: 0,
    pendingReview: 0,
    duplicatesSkipped: 0,
    invalidSkipped: 0,
    errors: [],
    details: [],
  };

  const redis = getRedis();
  if (!redis) {
    summary.errors.push('Redis not configured — cannot persist discovery results');
    return summary;
  }

  // Load already-indexed playlist IDs and video IDs
  const indexedPlaylists = new Set<string>(
    (await redis.smembers(INDEXED_PLAYLISTS_KEY)).map(String)
  );
  const indexedVideoIds = new Set<string>(
    (await redis.smembers(INDEXED_VIDEO_IDS_KEY)).map(String)
  );

  // Load existing series IDs from Redis
  const existingSeriesIds = new Set<string>(
    (await redis.smembers(KEYS.seriesList)).map(String)
  );

  // Also load playlist IDs from expanded-catalog to avoid duplicates with yt-dlp catalog
  let expandedCatalogPlaylistIds = new Set<string>();
  try {
    const { default: expandedCatalog } = await import('./expanded-catalog.json', { assert: { type: 'json' } });
    for (const entry of expandedCatalog as { playlistId?: string }[]) {
      if (entry.playlistId) expandedCatalogPlaylistIds.add(entry.playlistId);
    }
  } catch {
    // Not critical — proceed without it
  }

  let newPlaylistsProcessed = 0;
  const channels = OFFICIAL_ANIME_CHANNELS.filter(
    (ch) => !channelFilter || channelFilter.has(ch.id)
  );

  for (const channel of channels) {
    if (newPlaylistsProcessed >= maxNewPlaylists) break;

    const result: ChannelResult = {
      channelId: channel.id,
      channelName: channel.name,
      playlistsFound: 0,
      newPlaylists: 0,
      added: 0,
      pending: 0,
      errors: [],
    };

    try {
      const playlists = await getChannelPlaylists(channel.id, apiKey);
      result.playlistsFound = playlists.length;
      summary.playlistsFound += playlists.length;
      summary.channelsChecked++;

      for (const playlist of playlists) {
        if (newPlaylistsProcessed >= maxNewPlaylists) break;

        // Skip if already indexed or in yt-dlp catalog
        if (
          indexedPlaylists.has(playlist.id) ||
          expandedCatalogPlaylistIds.has(playlist.id)
        ) {
          summary.playlistsSkipped++;
          continue;
        }

        // Filter: only anime playlists
        if (!isAnimePlaylist(playlist, channel.strictFilter)) {
          summary.playlistsSkipped++;
          // Mark so we don't re-check it next run
          await redis.sadd(INDEXED_PLAYLISTS_KEY, playlist.id);
          indexedPlaylists.add(playlist.id);
          continue;
        }

        summary.playlistsNew++;
        result.newPlaylists++;
        newPlaylistsProcessed++;

        // Fetch videos from the playlist
        const videoItems = await getPlaylistItems(playlist.id, apiKey);
        const animeVideos = videoItems.filter((v) => isAnimeVideo(v.title));

        if (animeVideos.length === 0) {
          await redis.sadd(INDEXED_PLAYLISTS_KEY, playlist.id);
          indexedPlaylists.add(playlist.id);
          summary.invalidSkipped++;
          continue;
        }

        // Separate already-indexed videos
        const newVideos = animeVideos.filter((v) => !indexedVideoIds.has(v.videoId));
        summary.duplicatesSkipped += animeVideos.length - newVideos.length;

        if (newVideos.length === 0) {
          await redis.sadd(INDEXED_PLAYLISTS_KEY, playlist.id);
          indexedPlaylists.add(playlist.id);
          continue;
        }

        // Check embeddability for new video IDs
        const embedStatuses = await checkEmbeddability(
          newVideos.map((v) => v.videoId),
          apiKey
        );

        const embeddable = newVideos.filter((v) => {
          const s = embedStatuses.get(v.videoId);
          return s?.embeddable === true && s?.privacyStatus === 'public';
        });

        summary.invalidSkipped += newVideos.length - embeddable.length;

        if (embeddable.length === 0) {
          await redis.sadd(INDEXED_PLAYLISTS_KEY, playlist.id);
          indexedPlaylists.add(playlist.id);
          continue;
        }

        // Build episodes
        const episodes: Episode[] = embeddable
          .map((v, idx): Episode | null => {
            const epNum = extractEpisodeNumber(v.title) ?? idx + 1;
            return {
              episodeNumber: epNum,
              title: v.title,
              embedUrl: generateEmbedUrl(v.videoId),
              sourceVideoId: v.videoId,
              sourceName: channel.name,
              uploadDate: v.publishedAt,
              isEmbeddable: true,
              legalStatus: 'official_embed' as const,
              thumbnail: v.thumbnail,
              isNew: true,
            };
          })
          .filter((e): e is Episode => e !== null)
          .sort((a, b) => a.episodeNumber - b.episodeNumber);

        const animeTitle = cleanTitle(playlist.title);
        const animeId = slugify(animeTitle) || `anime-${playlist.id.slice(-8).toLowerCase()}`;
        const firstVideoId = episodes[0]?.sourceVideoId ?? '';

        // Check if a series with this ID already exists in Redis
        const existing = await redis.get<AnimeSeries>(KEYS.series(animeId));

        if (existing) {
          // Series exists — only add missing episodes
          const existingEpNums = new Set(existing.episodes.map((e) => e.episodeNumber));
          const missingEps = episodes.filter((e) => !existingEpNums.has(e.episodeNumber));

          if (missingEps.length > 0) {
            if (reviewBeforePublish) {
              for (const ep of missingEps) {
                await redis.lpush(
                  KEYS.pendingEpisodes(animeId),
                  JSON.stringify({
                    ...ep,
                    id: `${animeId}:${ep.episodeNumber}:${Date.now()}`,
                    seriesId: animeId,
                    detectedAt: new Date().toISOString(),
                    status: 'pending',
                  })
                );
                await redis.sadd(KEYS.pendingList, `${animeId}:${ep.episodeNumber}`);
              }
              result.pending += missingEps.length;
              summary.pendingReview += missingEps.length;
            } else {
              const merged = [...existing.episodes, ...missingEps]
                .sort((a, b) => a.episodeNumber - b.episodeNumber);
              existing.episodes = merged;
              existing.totalEpisodes = merged.length;
              existing.latestEpisode = Math.max(...merged.map((e) => e.episodeNumber));
              await redis.set(KEYS.series(animeId), existing);
              result.added += missingEps.length;
              summary.episodesAdded += missingEps.length;
            }
          } else {
            summary.duplicatesSkipped += episodes.length;
          }
        } else {
          // New series entirely
          const newSeries: AnimeSeries = {
            id: animeId,
            title: animeTitle || playlist.title,
            description: playlist.description || `Official anime from ${channel.name}.`,
            genres: [],
            type: /\bmovie|film\b/i.test(playlist.title) ? 'movie' : 'series',
            sourceName: channel.name,
            sourceType: 'official_embed',
            officialChannelId: channel.id,
            officialPlaylistId: playlist.id,
            thumbnail: `https://i.ytimg.com/vi/${firstVideoId}/hqdefault.jpg`,
            banner: `https://i.ytimg.com/vi/${firstVideoId}/maxresdefault.jpg`,
            language: 'English Sub',
            regionNote: `Licensed via ${channel.region}. Availability controlled by rights holder.`,
            licenseNote: `Embedded from official ${channel.name} YouTube channel.`,
            totalEpisodes: episodes.length,
            latestEpisode: episodes.at(-1)?.episodeNumber,
            trending: 70,
            episodes,
          };

          if (reviewBeforePublish) {
            // Store as pending series for admin review
            await redis.lpush(
              KEYS.pendingEpisodes(`new_series:${animeId}`),
              JSON.stringify({
                id: `new_series:${animeId}`,
                seriesId: animeId,
                seriesData: newSeries,
                detectedAt: new Date().toISOString(),
                status: 'pending',
              })
            );
            await redis.sadd(KEYS.pendingList, `new_series:${animeId}`);
            result.pending++;
            summary.pendingReview++;
          } else {
            await redis.set(KEYS.series(animeId), newSeries);
            await redis.sadd(KEYS.seriesList, animeId);
            result.added++;
            summary.animeTitlesAdded++;
            summary.episodesAdded += episodes.length;
            existingSeriesIds.add(animeId);
          }
        }

        // Mark playlist and videos as indexed
        await redis.sadd(INDEXED_PLAYLISTS_KEY, playlist.id);
        indexedPlaylists.add(playlist.id);
        for (const v of embeddable) {
          await redis.sadd(INDEXED_VIDEO_IDS_KEY, v.videoId);
          indexedVideoIds.add(v.videoId);
        }
      }
    } catch (err) {
      const msg = `Channel ${channel.name} (${channel.id}): ${String(err).slice(0, 200)}`;
      result.errors.push(msg);
      summary.errors.push(msg);
      console.error(msg);
    }

    summary.details.push(result);
  }

  // Write summary log to Redis
  try {
    await redis.lpush(KEYS.syncLogs, JSON.stringify({
      type: 'channel_discovery',
      timestamp: new Date().toISOString(),
      ...summary,
    }));
    await redis.set(KEYS.lastSync, new Date().toISOString());
  } catch {}

  return summary;
}
