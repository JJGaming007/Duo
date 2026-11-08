import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import type { DuoUser } from '@/lib/constants';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { ensureSchema } from '@/lib/db/ensure-schema';
import { SESSION_COOKIE, verifySession } from './session';

/**
 * The signed-in Duo user for this request, from the Google session cookie.
 * API routes use this instead of any user id the client sends.
 */
export async function currentUser(): Promise<DuoUser | null> {
    const jar = await cookies();
    const session = await verifySession(jar.get(SESSION_COOKIE)?.value);
    return session?.user ?? null;
}

export function unauthorized() {
    return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
}

const norm = (email: string) => email.trim().toLowerCase();

function envEmails(slot: DuoUser) {
    const raw = slot === 'user-1' ? process.env.DUO_USER_1_EMAIL : process.env.DUO_USER_2_EMAIL;
    return (raw || '').split(',').map(norm).filter(Boolean);
}

/**
 * Which Duo slot a Google account belongs to, from DUO_USER_1_EMAIL (Jibin) and
 * DUO_USER_2_EMAIL (Achsah); each may list several addresses, comma-separated.
 * Any other Google account is refused. The Gmail is stored on the user row, so
 * everything that person saves stays tied to that address.
 */
export async function linkGoogleAccount(rawEmail: string): Promise<DuoUser | null> {
    const email = norm(rawEmail);
    const slot: DuoUser | null = envEmails('user-1').includes(email)
        ? 'user-1'
        : envEmails('user-2').includes(email)
            ? 'user-2'
            : null;
    if (!slot) return null;

    await ensureSchema();
    await db.update(users).set({ email }).where(eq(users.id, slot));
    return slot;
}

export function authConfigured() {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.AUTH_SECRET && (envEmails('user-1').length || envEmails('user-2').length));
}
