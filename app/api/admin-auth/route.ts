// app/api/admin-auth/route.ts
import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'admin_session';
const MAX_AGE = 60 * 60 * 8; // 8 hours

export async function POST(req: NextRequest) {
  const { password } = await req.json() as { password?: string };
  const correct = process.env.ADMIN_PASSWORD;

  if (!correct) {
    return NextResponse.json({ error: 'ADMIN_PASSWORD env var not set' }, { status: 500 });
  }
  if (!password || password !== correct) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  // Simple signed token: base64(timestamp + ":" + HMAC-ish secret suffix)
  // Not a full JWT — enough to stop casual API access without a crypto dep.
  const token = Buffer.from(`${Date.now()}:${correct.slice(-8)}`).toString('base64');

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: MAX_AGE,
    path: '/',
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE);
  return res;
}

/** Call this in protected API routes to verify the session cookie. */
export function verifyAdminCookie(req: NextRequest): boolean {
  const token = req.cookies.get('admin_session')?.value;
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [ts, suffix] = decoded.split(':');
    const correct = process.env.ADMIN_PASSWORD;
    if (!correct || !suffix || suffix !== correct.slice(-8)) return false;
    // Token expires after 8 hours
    if (Date.now() - Number(ts) > MAX_AGE * 1000) return false;
    return true;
  } catch {
    return false;
  }
}
