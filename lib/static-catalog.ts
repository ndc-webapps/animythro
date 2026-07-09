import type { AnimeSeries, Episode } from '@/types';
import { MUSE_ASIA_CHANNEL_ID, SERIES_CONFIGS, TRAILER_CONFIGS } from './catalog-config';
import officialPlaylistsJson from './official-playlists.json';
import expandedCatalogJson from './expanded-catalog.json';
import expandedPlaylistsJson from './expanded-playlists.json';

export interface PlaylistVideo {
  id: string;
  title: string;
  uploadDate?: string;
  thumbnail?: string;
  duration?: number;
}

export interface StaticSeriesConfig {
  key: string;
  id: string;
  title: string;
  description: string;
  genres: string[];
  year?: number;
  playlistId: string;
  trending: number;
  type?: AnimeSeries['type'];
  sourceName?: string;
  channelId?: string;
  regionNote?: string;
}

export interface CatalogSnapshot {
  expandedCatalog: StaticSeriesConfig[];
  expandedPlaylists: Record<string, PlaylistVideo[]>;
}

const officialPlaylists = officialPlaylistsJson as Record<string, PlaylistVideo[]>;
const bundledSnapshot: CatalogSnapshot = {
  expandedCatalog: expandedCatalogJson as StaticSeriesConfig[],
  expandedPlaylists: expandedPlaylistsJson as Record<string, PlaylistVideo[]>,
};

function getEpisodeNumber(title: string, index: number) {
  const match =
    title.match(/Episode\s*0*(\d+)/i) ??
    title.match(/\bEP\s*0*(\d+)/i) ??
    title.match(/#\s*0*(\d+)/);
  return match ? Number(match[1]) : index + 1;
}

function getType(config: StaticSeriesConfig): AnimeSeries['type'] {
  if (config.type) return config.type;
  return /\b(movie|film)\b/i.test(config.title) ? 'movie' : 'series';
}

function getSourceName(config: StaticSeriesConfig) {
  return config.sourceName ?? 'Official YouTube';
}

function buildSeries(config: StaticSeriesConfig, videos: PlaylistVideo[]): AnimeSeries {
  const episodesByNumber = new Map<number, Episode>();
  const sourceName = getSourceName(config);

  videos.forEach((video, index) => {
    if (!video.id || !video.title) return;
    const episodeNumber = getEpisodeNumber(video.title, index);

    episodesByNumber.set(episodeNumber, {
      episodeNumber,
      title: video.title,
      embedUrl: `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`,
      sourceVideoId: video.id,
      sourceName,
      uploadDate: video.uploadDate,
      isEmbeddable: true,
      legalStatus: 'official_embed',
      thumbnail: video.thumbnail ?? `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
    });
  });

  const episodes = Array.from(episodesByNumber.values()).sort(
    (a, b) => a.episodeNumber - b.episodeNumber
  );
  const firstVideoId = episodes[0]?.sourceVideoId ?? videos[0]?.id ?? '';

  return {
    id: config.id,
    title: config.title,
    description: config.description,
    genres: config.genres,
    year: config.year,
    type: getType(config),
    sourceName,
    sourceType: 'official_embed',
    officialChannelId: config.channelId ?? MUSE_ASIA_CHANNEL_ID,
    officialPlaylistId: config.playlistId,
    thumbnail: firstVideoId ? `https://i.ytimg.com/vi/${firstVideoId}/hqdefault.jpg` : '/placeholder-poster.svg',
    banner: firstVideoId ? `https://i.ytimg.com/vi/${firstVideoId}/maxresdefault.jpg` : '/placeholder-banner.svg',
    language: 'English Sub',
    regionNote: config.regionNote ?? 'Availability is controlled by the rights holder.',
    licenseNote: `Full episodes embedded from the official ${sourceName} channel.`,
    totalEpisodes: episodes.length,
    latestEpisode: episodes.at(-1)?.episodeNumber,
    trending: config.trending,
    episodes,
  };
}

function buildTrailer(trailer: (typeof TRAILER_CONFIGS)[number]): AnimeSeries {
  return {
    id: trailer.id,
    title: `${trailer.animeTitle} Official Trailer`,
    description: `Official ${trailer.animeTitle} trailer.`,
    genres: trailer.genres,
    year: trailer.year,
    type: 'trailer',
    sourceName: 'Official YouTube',
    sourceType: 'official_embed',
    officialChannelId: MUSE_ASIA_CHANNEL_ID,
    thumbnail: `https://i.ytimg.com/vi/${trailer.videoId}/hqdefault.jpg`,
    banner: `https://i.ytimg.com/vi/${trailer.videoId}/maxresdefault.jpg`,
    language: 'English Sub',
    licenseNote: 'Official trailer embedded from the rights holder channel.',
    totalEpisodes: 1,
    latestEpisode: 1,
    trending: trailer.trending,
    episodes: [{
      episodeNumber: 1,
      title: `${trailer.animeTitle} Official Trailer`,
      embedUrl: `https://www.youtube-nocookie.com/embed/${trailer.videoId}?autoplay=1&rel=0`,
      sourceVideoId: trailer.videoId,
      sourceName: 'Official YouTube',
      isEmbeddable: true,
      legalStatus: 'official_embed',
      thumbnail: `https://i.ytimg.com/vi/${trailer.videoId}/hqdefault.jpg`,
    }],
  };
}

export function buildCatalogFromSnapshot(snapshot: CatalogSnapshot = bundledSnapshot): AnimeSeries[] {
  const featured = SERIES_CONFIGS.map((config) =>
    buildSeries(config, officialPlaylists[config.key] ?? [])
  );
  const expanded = snapshot.expandedCatalog.map((config) =>
    buildSeries(config, snapshot.expandedPlaylists[config.key] ?? [])
  );
  const trailers = TRAILER_CONFIGS.map(buildTrailer);

  const seen = new Set<string>();
  return [...featured, ...expanded, ...trailers].filter((series) => {
    if (seen.has(series.id)) return false;
    seen.add(series.id);
    return true;
  });
}

export const STATIC_CATALOG = buildCatalogFromSnapshot();

export function getStaticAnimeIds() {
  return STATIC_CATALOG.map((series) => series.id);
}

export function countCatalogEpisodes(catalog: AnimeSeries[]) {
  return catalog.reduce((total, series) => total + series.episodes.length, 0);
}
