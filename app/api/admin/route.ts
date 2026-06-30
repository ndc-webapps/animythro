// app/api/admin/route.ts
import { NextResponse } from 'next/server';
import { getAdminInfo } from '@/lib/redis';

export const runtime = 'edge';

export async function GET() {
  const adminInfo = await getAdminInfo();
  return NextResponse.json(adminInfo);
}
