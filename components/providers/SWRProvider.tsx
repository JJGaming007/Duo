"use client"

import { useSyncExternalStore } from 'react'
import { SWRConfig, useSWRConfig, type Cache } from 'swr'
import { setAppMutate } from '@/lib/swr-mutate'

const STORAGE_KEY = 'codetrack-swr-cache-v1'

export const fetcher = (url: string) =>
    fetch(url).then(res => {
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
        return res.json()
    })

/**
 * SWR cache persisted to localStorage: when the app is opened, every screen
 * renders immediately with the last data it showed, then revalidates in the
 * background. This is what makes "open the app" feel instant.
 */
function stripPending(data: unknown) {
    type M = { image?: { url?: string } | null; audio?: { url?: string } | null }
    return Array.isArray(data) ? data.filter((m: M) => !m?.image?.url?.startsWith('blob:') && !m?.audio?.url?.startsWith('blob:')) : data
}

function localStorageProvider(): Cache {
    let entries: [string, unknown][] = []
    try {
        entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch { }
    const map = new Map<string, unknown>(entries)

    const persist = () => {
        try {
            const data = Array.from(map.entries() as Iterable<[string, { data?: unknown } | undefined]>)
                .filter(([k, v]) => !k.startsWith('$') && v?.data !== undefined)
            const json = JSON.stringify(data.map(([k, v]) => [k, { data: v!.data }]))
            // Drop unsent photo messages: their in-memory previews don't survive a reload
            localStorage.setItem(STORAGE_KEY, json.includes('"blob:') ? JSON.stringify(data.map(([k, v]) => [k, { data: stripPending(v!.data) }])) : json)
        } catch { }
    }
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') persist()
    })
    return map as Cache
}

const noopSubscribe = () => () => { }

/** Registers the cache-bound mutator before any sibling renders. */
function MutateBridge() {
    const { mutate, cache } = useSWRConfig()
    setAppMutate(mutate, cache)
    return null
}

export default function SWRProvider({ children }: { children: React.ReactNode }) {
    // The app renders client-side only. The persisted cache (and the current user,
    // stored in localStorage) can't match server HTML, so rendering them during
    // hydration would make React discard and redo the whole tree. This flips to
    // true right after hydration, so the first real frame already has cached data.
    const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false)
    if (!isClient) return null

    return (
        <SWRConfig
            value={{
                fetcher,
                provider: localStorageProvider,
                revalidateOnFocus: true,
                dedupingInterval: 2000,
                keepPreviousData: true,
            }}
        >
            <MutateBridge />
            {children}
        </SWRConfig>
    )
}
