// types/index.ts
export interface AnimeSeries {
  id: string;
  title: string;
  description: string;
  genres: string[];
  year?: number;
  type: 'series' | 'movie' | 'ova' | 'special' | 'trailer' | 'playlist';
  sourceName: string;
  sourceType: 'official_embed' | 'info_only';
  officialChannelId?: string;
  officialPlaylistId?: string;
  thumbnail: string;
  banner: string;
  language: string;
  regionNote?: string;
  licenseNote: string;
  totalEpisodes: number;
  latestEpisode?: number;
  lastSync?: string;
  episodes: Episode[];
  trending?: number;
  externalWatchUrl?: string;
  studio?: string;
  status?: 'ongoing' | 'completed' | 'upcoming';
  rating?: string;
  anilistId?: number;
}

export interface Episode {
  episodeNumber: number;
  title: string;
  embedUrl: string;
  sourceVideoId: string;
  sourceName: string;
  uploadDate?: string;
  isEmbeddable: boolean;
  legalStatus: 'official_embed';
  isNew?: boolean;
  thumbnail?: string;
  duration?: number;
}

export interface PendingEpisode {
  id: string;
  seriesId: string;
  episodeNumber: number;
  title: string;
  embedUrl: string;
  sourceVideoId: string;
  sourceName: string;
  uploadDate: string;
  detectedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  thumbnail?: string;
}

export interface WatchHistory {
  animeId: string;
  episodeNumber: number;
  timestamp: number;
  progress: number;
  secondsWatched?: number;
  completed?: boolean;
  title: string;
  thumbnail: string;
}

export interface ApprovedSource {
  sourceId: string;
  sourceName: string;
  platform: 'YouTube';
  officialChannelId: string;
  approvedPlaylists: {
    animeId: string;
    playlistId: string;
    autoSync: boolean;
    reviewBeforePublish: boolean;
    episodeRegex?: string;
  }[];
  trustLevel: 'official';
  notes: string;
}

export interface ManualAnimeInput {
  id: string;
  title: string;
  description: string;
  genres: string[];
  year?: number;
  type: 'series' | 'movie' | 'ova' | 'special';
  sourceName: string;
  externalWatchUrl?: string;
  thumbnail: string;
  banner: string;
  language: string;
  licenseNote: string;
  totalEpisodes: number;
  status?: 'ongoing' | 'completed' | 'upcoming';
  studio?: string;
  rating?: string;
  bulkEmbedUrls?: string[];
}
