import { NextResponse } from 'next/server';
import { appOrigin, redirectUri, safeNext, STATE_COOKIE } from '@/lib/auth/google';

// GET /api/auth/google?next=/chat — start "Sign in with Google"
export async function GET(req: Request) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !process.env.AUTH_SECRET) {
        return NextResponse.redirect(`${appOrigin(req)}/login?error=config`);
    }

    const next = safeNext(new URL(req.url).searchParams.get('next'));
    const state = crypto.randomUUID();

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri(req));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');

    const res = NextResponse.redirect(url.toString());
    res.cookies.set(STATE_COOKIE, JSON.stringify({ state, next }), {
        httpOnly: true,
        secure: appOrigin(req).startsWith('https://'),
        sameSite: 'lax',
        path: '/',
        maxAge: 600,
    });
    return res;
}
