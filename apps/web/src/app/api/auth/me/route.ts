import { NextResponse } from 'next/server';
import { currentSession, handle } from '@/server/http';

export const dynamic = 'force-dynamic';

export function GET() {
  return handle(async () => NextResponse.json({ session: await currentSession() }));
}
