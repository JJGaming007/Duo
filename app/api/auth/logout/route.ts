import { NextResponse } from 'next/server';
import { SESSION_COOKIE, USER_HINT_COOKIE } from '@/lib/auth/session';

// POST /api/auth/logout — sign this device out
export async function POST() {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    res.cookies.delete(USER_HINT_COOKIE);
    return res;
}
