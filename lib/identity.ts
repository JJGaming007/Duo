"use client"

import { useSyncExternalStore } from 'react'
import { DuoUser } from './constants'

// Set by the server at Google sign-in (see app/api/auth/callback/google). It's
// only a hint for rendering: every API route checks the signed session cookie.
const COOKIE = 'duo-user'

function readId(): DuoUser | null {
    try {
        const m = document.cookie.match(/(?:^|;\s*)duo-user=([^;]+)/)
        const v = m?.[1]
        if (v === 'user-1' || v === 'user-2') return v
    } catch { /* cookies unavailable */ }
    return null
}

const subscribe = (cb: () => void) => {
    window.addEventListener('focus', cb)
    return () => window.removeEventListener('focus', cb)
}

/**
 * The signed-in Duo user, read synchronously so data fetching can start on
 * the very first client render (no extra effect pass).
 */
export function useIdentity() {
    const currentId = useSyncExternalStore<DuoUser | null>(subscribe, readId, () => null)
    return { currentId, signOut, isLoading: currentId === null }
}

// Device-local data that belongs to whoever was signed in
const LOCAL_KEYS = ['codetrack-swr-cache-v1', 'duo-hidden-messages', 'codetrack-user-id']

export async function signOut() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' })
    } catch { }
    try {
        document.cookie = `${COOKIE}=; Max-Age=0; path=/`
        LOCAL_KEYS.forEach((k) => localStorage.removeItem(k))
    } catch { }
    window.location.href = '/login'
}

/** Session expired or revoked: go to the login screen (once). */
let redirecting = false
export function handleUnauthorized() {
    if (redirecting || typeof window === 'undefined' || window.location.pathname === '/login') return
    redirecting = true
    const next = window.location.pathname + window.location.search
    window.location.href = `/login?next=${encodeURIComponent(next)}`
}
