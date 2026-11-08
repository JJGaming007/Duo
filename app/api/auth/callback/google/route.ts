import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { appOrigin, redirectUri, safeNext, STATE_COOKIE } from '@/lib/auth/google';
import { linkGoogleAccount } from '@/lib/auth/server';
import { SESSION_COOKIE, SESSION_MAX_AGE, signSession, USER_HINT_COOKIE } from '@/lib/auth/session';

type IdToken = { iss?: string; aud?: string; email?: string; email_verified?: boolean | string; exp?: number };

function decodeJwtPayload(jwt: string): IdToken {
    const part = jwt.split('.')[1] ?? '';
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

// GET /api/auth/callback/google — Google sends the user back here
export async function GET(req: Request) {
    const origin = appOrigin(req);
    const fail = (error: string) => {
        const res = NextResponse.redirect(`${origin}/login?error=${error}`);
        res.cookies.delete(STATE_COOKIE);
        return res;
    };

    try {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        if (url.searchParams.get('error') || !code) return fail('cancelled');

        const jar = await cookies();
        let saved: { state?: string; next?: string } = {};
        try {
            saved = JSON.parse(jar.get(STATE_COOKIE)?.value || '{}');
        } catch { }
        if (!saved.state || saved.state !== url.searchParams.get('state')) return fail('state');

        // Exchange the code directly with Google over TLS, so the returned
        // id_token is authentic (no separate signature check needed).
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                code,
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: redirectUri(req),
                grant_type: 'authorization_code',
            }),
        });
        if (!tokenRes.ok) {
            console.error('Google token exchange failed', tokenRes.status, await tokenRes.text().catch(() => ''));
            return fail('google');
        }
        const { id_token } = (await tokenRes.json()) as { id_token?: string };
        if (!id_token) return fail('google');

        const claims = decodeJwtPayload(id_token);
        const validIss = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
        const verified = claims.email_verified === true || claims.email_verified === 'true';
        if (!validIss || claims.aud !== process.env.GOOGLE_CLIENT_ID || !claims.email || !verified) return fail('google');
        if (!claims.exp || claims.exp * 1000 < Date.now()) return fail('google');

        const user = await linkGoogleAccount(claims.email);
        if (!user) return fail('not_allowed');

        const secure = origin.startsWith('https://');
        const res = NextResponse.redirect(`${origin}${safeNext(saved.next)}`);
        res.cookies.delete(STATE_COOKIE);
        res.cookies.set(SESSION_COOKIE, await signSession(user, claims.email.toLowerCase()), {
            httpOnly: true,
            secure,
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_MAX_AGE,
        });
        res.cookies.set(USER_HINT_COOKIE, user, { httpOnly: false, secure, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE });
        return res;
    } catch (e) {
        console.error('Google sign-in failed', e);
        return fail('google');
    }
}
