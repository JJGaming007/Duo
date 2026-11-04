"use client"

import { useSyncExternalStore } from 'react'
import { DuoUser } from './constants'

const KEY = 'codetrack-user-id'

function readId(): DuoUser {
    try {
        const stored = localStorage.getItem(KEY) as DuoUser | null
        if (stored === 'user-1' || stored === 'user-2') return stored
        localStorage.setItem(KEY, 'user-1')
    } catch { /* storage unavailable */ }
    return 'user-1'
}

const subscribe = (cb: () => void) => {
    window.addEventListener('storage', cb)
    return () => window.removeEventListener('storage', cb)
}

/**
 * Identity is read synchronously from localStorage on the client, so data
 * fetching can start on the very first client render (no extra effect pass).
 */
export function useIdentity() {
    const currentId = useSyncExternalStore<DuoUser | null>(subscribe, readId, () => null)

    const switchUser = (id: DuoUser) => {
        try { localStorage.setItem(KEY, id) } catch { }
        window.location.reload() // Reload to refresh all data context
    }

    return { currentId, switchUser, isLoading: currentId === null }
}
