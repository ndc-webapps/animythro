// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const PROTECTED = ['/api/admin', '/api/admin-anime', '/api/pending', '/api/sync', '/api/cron'];
const MAX_AGE = 60 * 60 * 8 * 1000; // 8 hours in ms

function verifyAdminCookie(req: NextRequest): boolean {
  const token = req.cookies.get('admin_session')?.value;
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [ts, suffix] = decoded.split(':');
    const correct = process.env.ADMIN_PASSWORD;
    if (!correct || !suffix || suffix !== correct.slice(-8)) return false;
    if (Date.now() - Number(ts) > MAX_AGE) return false;
    return true;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  // /api/admin-auth itself is the login endpoint — never block it
  if (!isProtected || pathname.startsWith('/api/admin-auth')) return NextResponse.next();

  // Cron route: also allow CRON_SECRET bearer token (for Vercel Cron / GitHub Action)
  if (pathname.startsWith('/api/cron')) {
    const auth = req.headers.get('authorization') ?? '';
    const secret = process.env.CRON_SECRET;
    if (secret && auth === `Bearer ${secret}`) return NextResponse.next();
  }

  if (!verifyAdminCookie(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/admin/:path*', '/api/admin-anime/:path*', '/api/pending/:path*', '/api/sync/:path*', '/api/cron/:path*'],
};
