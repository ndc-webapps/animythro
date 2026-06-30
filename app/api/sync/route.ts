// app/api/sync/route.ts
// POST /api/sync
//
// Body (all optional):
//   { mode: 'discover' | 'playlist', channels: string[], reviewBeforePublish: boolean }
//
//   mode='discover'  → channel-level discovery (new anime & episodes from official channels)
//   mode='playlist'  → legacy: only syncs pre-configured playlists in APPROVED_SOURCES
//   default          → 'discover'

import { NextResponse } from 'next/server';
import { discoverFromChannels } from '@/lib/channel-discovery';
import { syncAllSeries } from '@/lib/sync-engine';

export const runtime = 'edge';

export async function POST(req: Request) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'YOUTUBE_API_KEY not set in environment variables.' },
      { status: 500 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json().catch(() => ({}));
  } catch {}

  const mode = (body.mode as string) ?? 'discover';
  const reviewBeforePublish = body.reviewBeforePublish !== false; // default: true
  const channels = Array.isArray(body.channels) ? body.channels as string[] : undefined;

  try {
    if (mode === 'playlist') {
      // Legacy: sync only pre-configured Muse Asia playlists
      const result = await syncAllSeries(apiKey, reviewBeforePublish);
      return NextResponse.json({ mode: 'playlist', ...result });
    }

    // Default: full channel discovery
    const result = await discoverFromChannels(apiKey, {
      channels,
      reviewBeforePublish,
    });

    // Return summary in a format the admin page sync-results UI can consume
    const legacyResults = result.details.flatMap((d) => [
      ...Array.from({ length: d.added }, (_, i) => ({
        animeId: d.channelId,
        title: `${d.channelName} (${i + 1} added)`,
        status: 'synced' as const,
        message: `New anime/episodes added from ${d.channelName}`,
      })),
      ...d.errors.map((e) => ({
        animeId: d.channelId,
        title: d.channelName,
        status: 'failed' as const,
        message: e,
      })),
    ]);

    return NextResponse.json({
      mode: 'discover',
      summary: {
        channelsChecked: result.channelsChecked,
        animeTitlesAdded: result.animeTitlesAdded,
        episodesAdded: result.episodesAdded,
        pendingReview: result.pendingReview,
        duplicatesSkipped: result.duplicatesSkipped,
        invalidSkipped: result.invalidSkipped,
        errors: result.errors.length,
      },
      // Legacy 'results' key kept so admin page sync-results UI still renders
      results: legacyResults,
      details: result.details,
    });
  } catch (err) {
    console.error('/api/sync error:', err);
    return NextResponse.json(
      { error: 'Sync failed', detail: String(err).slice(0, 300) },
      { status: 500 }
    );
  }
}
