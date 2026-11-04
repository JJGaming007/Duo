"use client"

import { useSyncExternalStore } from 'react'

// Per-device preferences stored in localStorage, readable synchronously.

const CODING_KEY = 'duo-coding-mode'
const EVENT = 'duo-prefs-change'

const subscribe = (cb: () => void) => {
    window.addEventListener('storage', cb)
    window.addEventListener(EVENT, cb)
    return () => {
        window.removeEventListener('storage', cb)
        window.removeEventListener(EVENT, cb)
    }
}

const readCoding = () => {
    try {
        return localStorage.getItem(CODING_KEY) === '1'
    } catch {
        return false
    }
}

/** Coding features (tracker, log, analytics, playground) are hidden unless enabled. */
export function useCodingMode() {
    const enabled = useSyncExternalStore(subscribe, readCoding, () => false)
    const setEnabled = (on: boolean) => {
        try {
            localStorage.setItem(CODING_KEY, on ? '1' : '0')
        } catch { }
        window.dispatchEvent(new Event(EVENT))
    }
    return [enabled, setEnabled] as const
}
