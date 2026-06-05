// app/api/pending/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getPendingEpisodes, getSeries, saveSeries, removePendingEpisode } from '@/lib/redis';
import { Episode } from '@/types';

export async function GET() {
  const pending = await getPendingEpisodes();
  return NextResponse.json(pending);
}

export async function POST(req: NextRequest) {
  const { action, episodeId } = await req.json();

  if (action === 'approve') {
    const allPending = await getPendingEpisodes();
    const episode = allPending.find((e) => e.id === episodeId);
    if (!episode) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    const series = await getSeries(episode.seriesId);
    if (series) {
      const newEpisode: Episode = {
        episodeNumber: episode.episodeNumber,
        title: episode.title,
        embedUrl: episode.embedUrl,
        sourceVideoId: episode.sourceVideoId,
        sourceName: episode.sourceName,
        uploadDate: episode.uploadDate,
        isEmbeddable: true,
        legalStatus: 'official_embed',
        isNew: true,
        thumbnail: episode.thumbnail,
      };

      const updatedEpisodes = [...series.episodes, newEpisode].sort((a, b) => a.episodeNumber - b.episodeNumber);
      series.episodes = updatedEpisodes;
      series.totalEpisodes = updatedEpisodes.length;
      series.latestEpisode = Math.max(...updatedEpisodes.map((e) => e.episodeNumber));
      await saveSeries(series);
    }

    await removePendingEpisode(episode);
    return NextResponse.json({ success: true });
  }

  if (action === 'reject') {
    const allPending = await getPendingEpisodes();
    const episode = allPending.find((e) => e.id === episodeId);
    if (episode) {
      await removePendingEpisode(episode);
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
