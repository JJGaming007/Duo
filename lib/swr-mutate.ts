import { mutate as defaultMutate, type Cache, type ScopedMutator } from 'swr'

// SWR's exported `mutate` only touches the DEFAULT cache. The app uses a custom
// (persisted) cache provider, so writes must go through the mutator bound to
// that cache. SWRProvider registers it here on mount.
let bound: ScopedMutator = defaultMutate
let boundCache: Cache | null = null

export function setAppMutate(m: ScopedMutator, cache: Cache) {
    bound = m
    boundCache = cache
}

export const appMutate: ScopedMutator = ((...args: Parameters<ScopedMutator>) =>
    (bound as (...a: Parameters<ScopedMutator>) => ReturnType<ScopedMutator>)(...args)) as ScopedMutator

/**
 * Locally patch cached data without refetching. Does nothing until the key has
 * data: ANY mutate() call — even one returning undefined — makes SWR discard a
 * fetch that is already in flight, which would leave the screen empty.
 */
export function patchCache<T>(key: string, fn: (data: T) => T) {
    const current = boundCache?.get(key)?.data as T | undefined
    if (current === undefined) return Promise.resolve(undefined)
    return appMutate<T>(key, (data) => (data === undefined ? data : fn(data)), { revalidate: false })
}

/** Read cached data without mutating (a mutate would cancel an in-flight fetch). */
export function readCache<T>(key: string): T | undefined {
    return boundCache?.get(key)?.data as T | undefined
}
