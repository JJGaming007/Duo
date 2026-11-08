import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';

// GET /api/auth/me — who this device is signed in as
export async function GET() {
    const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
    if (!session) return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    return NextResponse.json({ user: session.user, email: session.email });
}
