"use client"

// Online status + last seen.
//
// "Online" = the person has the app open on screen right now. Each phone joins
// a Pusher presence channel only while the app is visible and leaves it when
// hidden, so membership is an accurate live signal.
// "Last seen" = a timestamp saved while the app is open (heartbeat) and when it
// closes (sendBeacon), shown when someone isn't online.

import { useSyncExternalStore } from 'react'
import { pusherClient } from './pusher'

const CHANNEL = 'presence-duo'
const HEARTBEAT_MS = 60_000

let online = new Set<string>()
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function setOnline(next: Set<string>) {
    online = next
    emit()
}

export function useIsOnline(userId: string) {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb)
            return () => listeners.delete(cb)
        },
        () => online.has(userId),
        () => false,
    )
}

function sendSeen(me: string, beacon = false) {
    const body = JSON.stringify({ userId: me, seen: true })
    if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon('/api/duo', new Blob([body], { type: 'application/json' }))
        return
    }
    fetch('/api/duo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => { })
}

type Members = { each: (fn: (m: { id: string }) => void) => void }

/**
 * Start presence for this device. `onPartnerLeft` fires when someone goes
 * offline (to refresh their last-seen time). Returns a cleanup.
 */
export function startPresence(me: string, onPartnerLeft: () => void) {
    let timer: ReturnType<typeof setInterval> | undefined
    let joined = false

    const join = () => {
        if (joined) return
        joined = true
        const ch = pusherClient.subscribe(CHANNEL)
        ch.bind('pusher:subscription_succeeded', (members: Members) => {
            const next = new Set<string>()
            members.each((m) => m.id !== me && next.add(m.id))
            setOnline(next)
        })
        ch.bind('pusher:member_added', (m: { id: string }) => {
            if (m.id !== me) setOnline(new Set(online).add(m.id))
        })
        ch.bind('pusher:member_removed', (m: { id: string }) => {
            if (m.id === me) return
            const next = new Set(online)
            next.delete(m.id)
            setOnline(next)
            // Their last-seen beacon may land just after they leave
            setTimeout(onPartnerLeft, 2500)
        })
        sendSeen(me)
        timer = setInterval(() => sendSeen(me), HEARTBEAT_MS)
    }

    const leave = (beacon: boolean) => {
        if (!joined) return
        joined = false
        clearInterval(timer)
        sendSeen(me, beacon)
        pusherClient.unsubscribe(CHANNEL)
        setOnline(new Set())
    }

    const onVisibility = () => (document.visibilityState === 'visible' ? join() : leave(true))
    const onPageHide = () => leave(true)

    if (document.visibilityState === 'visible') join()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)

    return () => {
        document.removeEventListener('visibilitychange', onVisibility)
        window.removeEventListener('pagehide', onPageHide)
        leave(false)
    }
}

export function lastSeenLabel(iso: string | null | undefined) {
    if (!iso) return ''
    const d = new Date(iso)
    const mins = (Date.now() - d.getTime()) / 60000
    if (mins < 1) return 'last seen just now'
    const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return `last seen today at ${time}`
    if (d.toDateString() === yesterday.toDateString()) return `last seen yesterday at ${time}`
    return `last seen ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`
}
