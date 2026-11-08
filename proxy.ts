import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, USER_HINT_COOKIE, verifySession } from '@/lib/auth/session';

// Everything except the login screen and the Google OAuth routes needs a
// signed-in Google account. API routes also check the session themselves.
const PUBLIC = ['/login', '/api/auth/'];

export async function proxy(req: NextRequest) {
    const { pathname, search } = req.nextUrl;
    if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next();

    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value).catch(() => null);
    if (session) {
        const res = NextResponse.next();
        // Keep the client-side hint in sync with the real session
        if (req.cookies.get(USER_HINT_COOKIE)?.value !== session.user) {
            res.cookies.set(USER_HINT_COOKIE, session.user, { sameSite: 'lax', path: '/', secure: req.nextUrl.protocol === 'https:', maxAge: 60 * 60 * 24 * 365 });
        }
        return res;
    }

    if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Please sign in' }, { status: 401 });
    }
    const login = req.nextUrl.clone();
    login.pathname = '/login';
    login.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    const res = NextResponse.redirect(login);
    res.cookies.delete(USER_HINT_COOKIE);
    return res;
}

export const config = {
    // Skip build assets and public files (icons, manifest, service worker)
    matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons/|.*\\.(?:png|jpg|jpeg|svg|ico|webp|woff2?)$).*)'],
};
