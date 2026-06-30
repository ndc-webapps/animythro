// app/api/admin-anime/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { saveSeries } from '@/lib/redis';
import { AnimeSeries } from '@/types';

export const runtime = 'edge';

function isValidYouTubeEmbed(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      (u.hostname === 'www.youtube-nocookie.com' || u.hostname === 'www.youtube.com') &&
      u.pathname.startsWith('/embed/')
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Partial<AnimeSeries>;

    if (!body.title || !body.description || !body.licenseNote) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, licenseNote' },
        { status: 400 }
      );
    }

    // Validate all episode embed URLs
    if (body.episodes && body.episodes.length > 0) {
      for (const ep of body.episodes) {
        if (!isValidYouTubeEmbed(ep.embedUrl)) {
          return NextResponse.json(
            { error: `Invalid embed URL for episode ${ep.episodeNumber}: ${ep.embedUrl}. Only YouTube nocookie embeds are allowed.` },
            { status: 400 }
          );
        }
      }
    }

    const id = body.id || body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const series: AnimeSeries = {
      id,
      title: body.title,
      description: body.description,
      genres: body.genres ?? [],
      year: body.year,
      type: body.type ?? 'series',
      sourceName: body.sourceName ?? 'Manual Entry',
      sourceType: (body.episodes?.length ?? 0) > 0 ? 'official_embed' : 'info_only',
      thumbnail: body.thumbnail ?? '/placeholder-poster.svg',
      banner: body.banner ?? '/placeholder-banner.svg',
      language: body.language ?? 'Japanese (Sub)',
      licenseNote: body.licenseNote,
      regionNote: body.regionNote,
      totalEpisodes: body.episodes?.length ?? body.totalEpisodes ?? 0,
      latestEpisode: body.episodes?.at(-1)?.episodeNumber,
      episodes: body.episodes ?? [],
      trending: body.trending ?? 70,
      externalWatchUrl: body.externalWatchUrl,
      studio: body.studio,
      status: body.status,
      rating: body.rating,
      anilistId: body.anilistId,
    };

    await saveSeries(series);

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('admin-anime POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save anime' },
      { status: 500 }
    );
  }
}
