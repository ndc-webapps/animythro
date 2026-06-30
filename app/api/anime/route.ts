// app/api/anime/route.ts
import { NextResponse } from 'next/server';
import { getAllSeries } from '@/lib/redis';

export const runtime = 'edge';

export async function GET() {
  try {
    const series = await getAllSeries();
    return NextResponse.json(series);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch anime' }, { status: 500 });
  }
}
