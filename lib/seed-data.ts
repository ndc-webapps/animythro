import { AnimeSeries, ApprovedSource, Episode } from '@/types';
import officialPlaylists from './official-playlists.json';
import expandedPlaylists from './expanded-playlists.json';
import { MUSE_ASIA_CHANNEL_ID, SERIES_CONFIGS } from './catalog-config';

const playlistSnapshots = {
  ...officialPlaylists,
  ...expandedPlaylists,
} as Record<string, { id: string; title: string }[]>;

function buildFallbackSeries(config: (typeof SERIES_CONFIGS)[number]): AnimeSeries {
  const videos = playlistSnapshots[config.key] ?? [];
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

// Last-known official playlist snapshot. Public API responses refresh from YouTube at runtime.
export const SEED_SERIES: AnimeSeries[] = SERIES_CONFIGS.map(buildFallbackSeries);

export const APPROVED_SOURCES: ApprovedSource[] = [
  {
    sourceId: 'muse-asia',
    sourceName: 'Muse Asia Official',
    platform: 'YouTube',
    officialChannelId: MUSE_ASIA_CHANNEL_ID,
    approvedPlaylists: SERIES_CONFIGS.map((series) => ({
      animeId: series.id,
      playlistId: series.playlistId,
      autoSync: true,
      reviewBeforePublish: true,
      episodeRegex: 'Episode\\s*(\\d+)',
    })),
    trustLevel: 'official',
    notes: 'Official licensed full anime episodes for supported Asian regions.',
  },
];
