// app/api/cron/route.ts
import { NextResponse } from 'next/server';
import { syncAllSeries } from '@/lib/sync-engine';

export const runtime = 'edge';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'YouTube API key not configured' }, { status: 500 });
  }
  
  const result = await syncAllSeries(apiKey, true);
  return NextResponse.json(result);
}