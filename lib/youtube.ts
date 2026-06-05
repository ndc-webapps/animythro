// lib/youtube.ts
// YouTube Data API v3 helpers.
// All functions require a valid YOUTUBE_API_KEY from process.env.
// Quota cost guide (units/day limit: 10,000):
//   playlistItems.list → 1 unit/page (50 items/page)
//   playlists.list     → 1 unit/page (50 items/page)
//   videos.list        → 1 unit/page (50 items/page)

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

/* ── Types ──────────────────────────────────────────────────────────── */

export interface YouTubePlaylistItem {
  id: string;
  videoId: string;
  title: string;
  publishedAt: string;
  description: string;
  thumbnail: string;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  description: string;
  itemCount: number;
  publishedAt: string;
  thumbnail: string;
}

export interface EmbedStatus {
  videoId: string;
  embeddable: boolean;
  privacyStatus: string; // 'public' | 'unlisted' | 'private'
}

/* ── Fetch helpers ──────────────────────────────────────────────────── */

async function ytFetch(path: string, params: Record<string, string>, apiKey: string): Promise<Response> {
  const url = new URL(`${YT_BASE}${path}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`YouTube API ${path} → HTTP ${res.status}: ${err.slice(0, 200)}`);
  }
  return res;
}

/* ── Playlist items (videos in a playlist) ──────────────────────────── */

export async function getPlaylistItems(
  playlistId: string,
  apiKey: string,
  maxPages = 10
): Promise<YouTubePlaylistItem[]> {
  const items: YouTubePlaylistItem[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      part: 'snippet',
      playlistId,
      maxResults: '50',
    };
    if (pageToken) params.pageToken = pageToken;

    try {
      const res = await ytFetch('/playlistItems', params, apiKey);
      const data = await res.json();

      for (const item of data.items ?? []) {
        const videoId: string = item.snippet?.resourceId?.videoId ?? '';
        if (!videoId) continue;
        const title: string = item.snippet?.title ?? '';
        // Skip deleted / private items
        if (/^\[(?:Deleted|Private)\s+video\]$/i.test(title)) continue;

        items.push({
          id: item.id,
          videoId,
          title,
          publishedAt: item.snippet?.publishedAt ?? '',
          description: item.snippet?.description ?? '',
          thumbnail:
            item.snippet?.thumbnails?.high?.url ??
            item.snippet?.thumbnails?.medium?.url ??
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        });
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    } catch (err) {
      console.error(`getPlaylistItems(${playlistId}) page ${page}:`, err);
      break;
    }
  }

  return items;
}

/* ── Channel playlists ──────────────────────────────────────────────── */

export async function getChannelPlaylists(
  channelId: string,
  apiKey: string,
  maxPages = 20
): Promise<YouTubePlaylist[]> {
  const playlists: YouTubePlaylist[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      part: 'snippet,contentDetails',
      channelId,
      maxResults: '50',
    };
    if (pageToken) params.pageToken = pageToken;

    try {
      const res = await ytFetch('/playlists', params, apiKey);
      const data = await res.json();

      for (const item of data.items ?? []) {
        playlists.push({
          id: item.id,
          title: item.snippet?.title ?? '',
          description: item.snippet?.description ?? '',
          itemCount: item.contentDetails?.itemCount ?? 0,
          publishedAt: item.snippet?.publishedAt ?? '',
          thumbnail:
            item.snippet?.thumbnails?.high?.url ??
            item.snippet?.thumbnails?.medium?.url ?? '',
        });
      }

      pageToken = data.nextPageToken;
      if (!pageToken) break;
    } catch (err) {
      console.error(`getChannelPlaylists(${channelId}) page ${page}:`, err);
      break;
    }
  }

  return playlists;
}

/* ── Embeddability + privacy check (batch: up to 50 IDs per call) ──── */

export async function checkEmbeddability(
  videoIds: string[],
  apiKey: string
): Promise<Map<string, EmbedStatus>> {
  const result = new Map<string, EmbedStatus>();
  // Batch into groups of 50
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    try {
      const res = await ytFetch('/videos', {
        part: 'status',
        id: batch.join(','),
        maxResults: '50',
      }, apiKey);
      const data = await res.json();
      for (const item of data.items ?? []) {
        result.set(item.id, {
          videoId: item.id,
          embeddable: item.status?.embeddable === true,
          privacyStatus: item.status?.privacyStatus ?? 'unknown',
        });
      }
    } catch (err) {
      console.error(`checkEmbeddability batch ${i}:`, err);
    }
  }
  return result;
}

/* ── Content filters ────────────────────────────────────────────────── */

export function extractEpisodeNumber(title: string, regexPattern?: string): number | null {
  const patterns = regexPattern
    ? [new RegExp(regexPattern, 'i')]
    : [
        /Episode\s*(\d+)/i,
        /Ep\.?\s*(\d+)/i,
        /EP\s*(\d+)/i,
        /#(\d+)\b/,
        /\b(\d+)\s*(?:st|nd|rd|th)\s+Episode/i,
        /S\d+E(\d+)/i,
        /\|\s*(\d+)\s*\|/,
        /[\s\-–]\s*(\d{2,3})\s*[\s\[\(]/,
        /^(\d{2,3})\s/,
      ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) {
      const n = parseInt(match[1], 10);
      // Sanity: episode numbers 1–9999 only
      if (n >= 1 && n <= 9999) return n;
    }
  }
  return null;
}

export function generateEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`;
}

export function generateEmbedUrlAutoplay(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
}
