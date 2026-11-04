"use client"

import { SWRConfig, type Cache } from 'swr'

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
function localStorageProvider(): Cache {
    let entries: [string, any][] = []
    try {
        entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch { }
    const map = new Map<string, any>(entries)

    const persist = () => {
        try {
            const data = Array.from(map.entries()).filter(([k, v]) => !k.startsWith('$') && v?.data !== undefined)
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data.map(([k, v]) => [k, { data: v.data }])))
        } catch { }
    }
    window.addEventListener('pagehide', persist)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') persist()
    })
    return map as Cache
}

export default function SWRProvider({ children }: { children: React.ReactNode }) {
    return (
        <SWRConfig
            value={{
                fetcher,
                provider: typeof window === 'undefined' ? undefined : localStorageProvider,
                revalidateOnFocus: true,
                dedupingInterval: 2000,
                keepPreviousData: true,
            }}
        >
            {children}
        </SWRConfig>
    )
}
