import { AnimeSeries, Episode } from '@/types';
import {
  MUSE_ASIA_CHANNEL_ID,
  SERIES_CONFIGS,
  TRAILER_CONFIGS,
  SeriesConfig,
} from './catalog-config';

interface PlaylistVideo {
  id: string;
  title: string;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
let catalogCache: { expiresAt: number; series: AnimeSeries[] } | null = null;

function findInitialData(html: string): unknown {
  const markers = ['var ytInitialData = ', 'window[\"ytInitialData\"] = ', 'ytInitialData = '];
  for (const marker of markers) {
    const start = html.indexOf(marker);
    if (start === -1) continue;
    const jsonStart = html.indexOf('{', start + marker.length);
    const jsonEnd = html.indexOf(';</script>', jsonStart);
    if (jsonStart !== -1 && jsonEnd !== -1) {
      return JSON.parse(html.slice(jsonStart, jsonEnd));
    }
  }
  throw new Error('YouTube initial data was not found');
}

function collectPlaylistVideos(value: unknown, videos: PlaylistVideo[]) {
  if (!value || typeof value !== 'object') return;

  if ('playlistVideoRenderer' in value) {
    const renderer = (value as { playlistVideoRenderer?: Record<string, unknown> }).playlistVideoRenderer;
    const videoId = renderer?.videoId;
    const title = renderer?.title as { runs?: { text?: string }[]; simpleText?: string } | undefined;
    const text = title?.runs?.map((run) => run.text ?? '').join('') || title?.simpleText;
    if (typeof videoId === 'string' && text) {
      videos.push({ id: videoId, title: text });
    }
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      child.forEach((item) => collectPlaylistVideos(item, videos));
    } else {
      collectPlaylistVideos(child, videos);
    }
  }
}

async function fetchPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  const response = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error(`YouTube playlist request failed: ${response.status}`);

  const videos: PlaylistVideo[] = [];
  collectPlaylistVideos(findInitialData(await response.text()), videos);
  return Array.from(new Map(videos.map((video) => [video.id, video])).values());
}

function buildSeries(config: SeriesConfig, videos: PlaylistVideo[]): AnimeSeries {
  const episodesByNumber = new Map<number, Episode>();

  videos.forEach((video, index) => {
    const match = video.title.match(/Episode\s*0*(\d+)/i);
    const episodeNumber = match ? Number(match[1]) : index + 1;

    episodesByNumber.set(episodeNumber, {
      episodeNumber,
      title: video.title,
      embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`,
      sourceVideoId: video.id,
      sourceName: config.sourceName ?? 'Muse Asia Official',
      isEmbeddable: true,
      legalStatus: 'official_embed',
      thumbnail: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    });
  });

  const episodes = Array.from(episodesByNumber.values())
    .sort((a, b) => a.episodeNumber - b.episodeNumber);
  const firstVideoId = episodes[0]?.sourceVideoId ?? '';
  const sourceName = config.sourceName ?? 'Muse Asia Official YouTube';

  return {
    id: config.id,
    title: config.title,
    description: config.description,
    genres: config.genres,
    year: config.year,
    type: config.type ?? 'series',
    sourceName,
    sourceType: 'official_embed',
    officialChannelId: config.channelId ?? MUSE_ASIA_CHANNEL_ID,
    officialPlaylistId: config.playlistId,
    thumbnail: `https://i.ytimg.com/vi/${firstVideoId}/hqdefault.jpg`,
    banner: `https://i.ytimg.com/vi/${firstVideoId}/maxresdefault.jpg`,
    language: 'English Sub',
    regionNote: config.regionNote ?? 'Licensed for supported Asian regions. Availability is controlled by the rights holder.',
    licenseNote: `Full episodes embedded from the official ${sourceName} channel.`,
    totalEpisodes: episodes.length,
    latestEpisode: episodes.at(-1)?.episodeNumber,
    trending: config.trending,
    episodes,
  };
}

async function buildTrailers(): Promise<AnimeSeries[]> {
  return Promise.all(TRAILER_CONFIGS.map(async (trailer) => {
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${trailer.videoId}&format=json`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`YouTube trailer request failed: ${response.status}`);
    const metadata = await response.json() as { title: string; author_name: string; thumbnail_url: string };

    return {
      id: trailer.id,
      title: metadata.title,
      description: `Official ${trailer.animeTitle} trailer from ${metadata.author_name}.`,
      genres: trailer.genres,
      year: trailer.year,
      type: 'trailer',
      sourceName: `${metadata.author_name} Official YouTube`,
      sourceType: 'official_embed',
      officialChannelId: MUSE_ASIA_CHANNEL_ID,
      thumbnail: metadata.thumbnail_url,
      banner: `https://i.ytimg.com/vi/${trailer.videoId}/maxresdefault.jpg`,
      language: 'English Sub',
      licenseNote: 'Official trailer embedded from the rights holder channel.',
      totalEpisodes: 1,
      latestEpisode: 1,
      trending: trailer.trending,
      episodes: [{
        episodeNumber: 1,
        title: metadata.title,
        embedUrl: `https://www.youtube-nocookie.com/embed/${trailer.videoId}?autoplay=1&rel=0`,
        sourceVideoId: trailer.videoId,
        sourceName: metadata.author_name,
        isEmbeddable: true,
        legalStatus: 'official_embed',
        thumbnail: metadata.thumbnail_url,
      }],
    };
  }));
}

export async function getLiveCatalog(): Promise<AnimeSeries[]> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) return catalogCache.series;

  const series = await Promise.all(SERIES_CONFIGS.map(async (config) => {
    try {
      const liveVideos = await fetchPlaylistVideos(config.playlistId);
      return buildSeries(config, liveVideos);
    } catch (error) {
      console.error(`Live playlist refresh failed for ${config.title}:`, error);
      return buildSeries(config, []);
    }
  }));

  let trailers: AnimeSeries[] = [];
  try {
    trailers = await buildTrailers();
  } catch (error) {
    console.error('Live trailer refresh failed:', error);
  }

  // Dedupe by id (featured configs take priority over expanded entries) so the
  // API never returns duplicate ids → no duplicate React keys, no dup cards.
  const seen = new Set<string>();
  const catalog = [...series, ...trailers].filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  catalogCache = { expiresAt: Date.now() + CACHE_TTL_MS, series: catalog };
  return catalog;
}
