import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/server/auth/session';
import { assertSameOrigin, handle } from '@/server/http';

export function POST(req: Request) {
  return handle(async () => {
    assertSameOrigin(req);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  });
}
