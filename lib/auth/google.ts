export const STATE_COOKIE = 'duo-oauth-state';

/** Public origin of the app (set AUTH_URL if the platform's request URL isn't the public one). */
export function appOrigin(req: Request) {
    const configured = process.env.AUTH_URL?.replace(/\/+$/, '');
    if (configured) return configured;
    const url = new URL(req.url);
    const host = req.headers.get('x-forwarded-host') ?? url.host;
    const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '');
    return `${proto}://${host}`;
}

export const redirectUri = (req: Request) => `${appOrigin(req)}/api/auth/callback/google`;

/** Only same-site paths, so `next` can't send people to another site after login */
export function safeNext(next: string | null | undefined) {
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
    if (next.startsWith('/login') || next.startsWith('/api/')) return '/';
    return next;
}
