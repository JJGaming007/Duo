// Signed session cookie (HMAC-SHA256 via Web Crypto, so it works in both the
// proxy and in route handlers). The cookie holds which Duo slot the Google
// account is linked to, plus the Gmail address it was issued for.

import type { DuoUser } from '@/lib/constants';

export const SESSION_COOKIE = 'duo-session';
/** Non-httpOnly mirror of the slot id so the client can render instantly. Never trusted by the server. */
export const USER_HINT_COOKIE = 'duo-user';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365; // 1 year: installed PWAs shouldn't keep signing out

export type Session = { user: DuoUser; email: string; exp: number };

const enc = new TextEncoder();

function secret() {
    const s = process.env.AUTH_SECRET;
    if (!s || s.length < 16) throw new Error('AUTH_SECRET is not set (needs at least 16 characters)');
    return s;
}

function b64url(bytes: Uint8Array) {
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

let keyPromise: Promise<CryptoKey> | null = null;
function key() {
    if (!keyPromise) {
        keyPromise = crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    }
    return keyPromise;
}

export async function signSession(user: DuoUser, email: string): Promise<string> {
    const payload: Session = { user, email, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE };
    const body = b64url(enc.encode(JSON.stringify(payload)));
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await key(), enc.encode(body)));
    return `${body}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
    if (!token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    try {
        const ok = await crypto.subtle.verify('HMAC', await key(), fromB64url(sig), enc.encode(body));
        if (!ok) return null;
        const data = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session;
        if (data.user !== 'user-1' && data.user !== 'user-2') return null;
        if (typeof data.exp !== 'number' || data.exp * 1000 < Date.now()) return null;
        return data;
    } catch {
        return null;
    }
}
