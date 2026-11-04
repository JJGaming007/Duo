"use client"

import { useSyncExternalStore } from 'react'

// Tracks the on-screen keyboard via the VisualViewport API.
//
// iOS doesn't resize the page when the keyboard opens: it shrinks the *visual*
// viewport and scrolls it, which drags fixed headers/tab bars around. Android
// (with interactive-widget=resizes-content) shrinks the layout instead, but the
// tab bar would still sit on top of the keyboard. In both cases we want to know
// the visible area above the keyboard, so screens can pin themselves to it.

export type KeyboardState = { open: boolean; height: number; top: number }

const CLOSED: KeyboardState = { open: false, height: 0, top: 0 }
let state: KeyboardState = CLOSED
let baseline = 0
const listeners = new Set<() => void>()
let started = false

const isEditable = (el: Element | null) =>
    !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes((el as HTMLInputElement).type)) || (el as HTMLElement).isContentEditable)

function measure() {
    const vv = window.visualViewport
    if (!vv) return
    // Largest height seen in this orientation = the height without a keyboard
    baseline = Math.max(baseline, vv.height, window.innerHeight)
    const open = isEditable(document.activeElement) && vv.height < baseline - 120
    const next: KeyboardState = open ? { open, height: Math.round(vv.height), top: Math.round(vv.offsetTop) } : CLOSED
    if (next.open !== state.open || next.height !== state.height || next.top !== state.top) {
        // iOS can leave the page scrolled up after the keyboard closes
        if (state.open && !open) window.scrollTo(0, 0)
        state = next
        document.documentElement.toggleAttribute('data-keyboard', open)
        listeners.forEach((l) => l())
    }
}

function start() {
    if (started || typeof window === 'undefined' || !window.visualViewport) return
    started = true
    const vv = window.visualViewport
    vv.addEventListener('resize', measure)
    vv.addEventListener('scroll', measure)
    window.addEventListener('orientationchange', () => {
        baseline = 0
        setTimeout(measure, 300)
    })
    // Focus changes don't always fire a viewport event (e.g. hardware keyboards)
    document.addEventListener('focusin', () => setTimeout(measure, 50))
    document.addEventListener('focusout', () => setTimeout(measure, 50))
    measure()
}

const subscribe = (cb: () => void) => {
    start()
    listeners.add(cb)
    return () => listeners.delete(cb)
}

export function useKeyboard(): KeyboardState {
    return useSyncExternalStore(subscribe, () => state, () => CLOSED)
}
