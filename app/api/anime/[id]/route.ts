// app/api/anime/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSeries } from '@/lib/redis';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  try {
    const series = await getSeries(id);
    if (!series) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(series);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch series' }, { status: 500 });
  }
}