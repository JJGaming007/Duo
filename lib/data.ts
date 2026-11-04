"use client"

// Data hooks + actions. All screens read from the same SWR keys, which the
// RealtimeProvider keeps fresh from Pusher events, so switching tabs is instant.

import useSWR from 'swr'
import { appMutate as globalMutate, patchCache } from './swr-mutate'
import { useIdentity } from './identity'
import { getUserName, type DuoUser } from './constants'
import { todayKey } from './dates'
import type { ChatMessage, DuoMember, PrayerSubject, PrayerSummary } from './types'

export const KEYS = {
    messages: '/api/messages',
    duo: '/api/duo',
    subjects: '/api/prayer/subjects',
    prayer: (date = todayKey()) => `/api/prayer?date=${date}`,
}

async function send<T = unknown>(url: string, method: string, body: unknown): Promise<T> {
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!res.ok) {
        let msg = `Request failed (${res.status})`
        try {
            msg = (await res.json()).error || msg
        } catch { }
        throw new Error(msg)
    }
    return res.json()
}

/** Current user + partner */
export function useMe() {
    const { currentId, switchUser } = useIdentity()
    const me: DuoUser = currentId ?? 'user-1'
    const partner: DuoUser = me === 'user-1' ? 'user-2' : 'user-1'
    return {
        ready: currentId !== null,
        me,
        partner,
        meName: getUserName(me),
        partnerName: getUserName(partner),
        switchUser,
    }
}

// ---------------------------------------------------------------- Messages

export function useMessages() {
    return useSWR<ChatMessage[]>(KEYS.messages)
}

/** Insert or replace (by id or clientId), keeping newest-first order. */
export function upsertMessage(list: ChatMessage[] | undefined, msg: ChatMessage): ChatMessage[] {
    const arr = list ? [...list] : []
    const idx = arr.findIndex((m) => m.id === msg.id || (!!msg.clientId && m.clientId === msg.clientId))
    if (idx >= 0) arr[idx] = { ...arr[idx], ...msg, pending: false, failed: false }
    else arr.unshift(msg)
    return arr.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

/**
 * Patch the cached message list. No-op until the first load has finished:
 * writing a value then would make SWR discard the in-flight fetch.
 */
export function patchMessages(fn: (list: ChatMessage[]) => ChatMessage[]) {
    return patchCache<ChatMessage[]>(KEYS.messages, fn)
}

export async function sendMessage(me: DuoUser, content: string, replyTo: ChatMessage | null) {
    const clientId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const optimistic: ChatMessage = {
        id: clientId,
        clientId,
        content,
        senderId: me,
        senderName: getUserName(me),
        createdAt: new Date().toISOString(),
        replyToId: replyTo?.id ?? null,
        replyTo: replyTo
            ? { id: replyTo.id, content: replyTo.content.slice(0, 120), senderId: replyTo.senderId, senderName: replyTo.senderName }
            : null,
        readAt: null,
        reactions: {},
        pending: true,
    }
    patchMessages((list) => upsertMessage(list, optimistic))
    try {
        const { message } = await send<{ message: ChatMessage }>('/api/messages', 'POST', {
            senderId: me,
            content,
            replyToId: replyTo?.id,
            clientId,
        })
        patchMessages((list) => upsertMessage(list, { ...message, clientId }))
    } catch (e) {
        patchMessages((list) => list.map((m) => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m)))
        throw e
    }
}

export async function retryMessage(me: DuoUser, msg: ChatMessage) {
    patchMessages((list) => list.filter((m) => m.clientId !== msg.clientId))
    await sendMessage(me, msg.content, msg.replyTo ? ({ ...msg.replyTo } as ChatMessage) : null)
}

export async function deleteMessage(me: DuoUser, id: string) {
    const before = await patchMessages((list) => list) // snapshot for rollback
    patchMessages((list) => list.filter((m) => m.id !== id))
    try {
        await send('/api/messages', 'DELETE', { messageId: id, senderId: me })
    } catch (e) {
        if (before) globalMutate(KEYS.messages, before, { revalidate: false })
        throw e
    }
}

export async function reactToMessage(me: DuoUser, id: string, emoji: string) {
    patchMessages((list) =>
        list.map((m) => {
            if (m.id !== id) return m
            const reactions = { ...m.reactions }
            if (reactions[me] === emoji) delete reactions[me]
            else reactions[me] = emoji
            return { ...m, reactions }
        }),
    )
    const { reactions } = await send<{ reactions: Record<string, string> }>('/api/messages/react', 'POST', {
        userId: me,
        messageId: id,
        emoji,
    })
    patchMessages((list) => list.map((m) => (m.id === id ? { ...m, reactions } : m)))
}

let lastReadPost = 0
export async function markRead(me: DuoUser) {
    const now = new Date().toISOString()
    let had = false
    patchMessages((list) =>
        list.map((m) => {
            if (m.senderId !== me && !m.readAt) {
                had = true
                return { ...m, readAt: now }
            }
            return m
        }),
    )
    if (!had || Date.now() - lastReadPost < 1500) return
    lastReadPost = Date.now()
    await send('/api/messages/read', 'POST', { userId: me }).catch(() => { })
}

export async function fetchOlderMessages(before: string) {
    const res = await fetch(`/api/messages?before=${encodeURIComponent(before)}&limit=50`)
    if (!res.ok) throw new Error('Failed to load earlier messages')
    return (await res.json()) as ChatMessage[]
}

export function unreadCount(list: ChatMessage[] | undefined, me: DuoUser) {
    return (list ?? []).filter((m) => m.senderId !== me && !m.readAt).length
}

const lastTyping = { t: 0 }
export function sendTyping(me: DuoUser) {
    if (Date.now() - lastTyping.t < 2500) return
    lastTyping.t = Date.now()
    send('/api/bond/nudge', 'POST', { senderId: me, type: 'typing' }).catch(() => { })
}

export function sendNudge(me: DuoUser) {
    return send('/api/bond/nudge', 'POST', { senderId: me })
}

// ---------------------------------------------------------------- Duo / moods

export function useDuo() {
    return useSWR<DuoMember[]>(KEYS.duo)
}

export async function setMood(me: DuoUser, emoji: string | null, label: string | null) {
    patchCache<DuoMember[]>(KEYS.duo, (list) =>
        list.map((u) => (u.id === me ? { ...u, moodEmoji: emoji, moodLabel: label, moodUpdatedAt: new Date().toISOString() } : u)),
    )
    await send('/api/duo', 'POST', { userId: me, emoji, label })
}

// ---------------------------------------------------------------- Prayer

export function usePrayer() {
    return useSWR<PrayerSummary>(KEYS.prayer())
}

export async function logPrayer(me: DuoUser, delta: 1 | -1, together = false) {
    const date = todayKey()
    const key = KEYS.prayer(date)
    const targets: DuoUser[] = together ? ['user-1', 'user-2'] : [me]
    patchCache<PrayerSummary>(
        key,
        (s) => {
            const today = { ...s.today }
            const week = s.week.map((d) => ({ ...d }))
            for (const u of targets) {
                today[u] = Math.max(0, today[u] + delta)
                const w = week.find((d) => d.date === date)
                if (w) w[u] = today[u]
            }
            return { ...s, today, week }
        },
    )
    try {
        const summary = await send<PrayerSummary>('/api/prayer', 'POST', { userId: me, date, delta, together })
        globalMutate(key, summary, { revalidate: false })
    } catch (e) {
        globalMutate(key)
        throw e
    }
}

export function useSubjects() {
    return useSWR<PrayerSubject[]>(KEYS.subjects)
}

function patchSubjects(fn: (list: PrayerSubject[]) => PrayerSubject[]) {
    return patchCache<PrayerSubject[]>(KEYS.subjects, fn)
}

export async function addSubject(me: DuoUser, title: string, forWhom: PrayerSubject['forWhom'], notes?: string) {
    const temp: PrayerSubject = {
        id: `tmp-${Date.now()}`,
        title,
        notes: notes ?? null,
        createdBy: me,
        forWhom,
        prayedCount: 0,
        lastPrayedAt: null,
        answeredAt: null,
        createdAt: new Date().toISOString(),
    }
    patchSubjects((list) => [temp, ...list])
    try {
        const created = await send<PrayerSubject>('/api/prayer/subjects', 'POST', { userId: me, title, forWhom, notes })
        patchSubjects((list) => list.map((s) => (s.id === temp.id ? created : s)))
    } catch (e) {
        patchSubjects((list) => list.filter((s) => s.id !== temp.id))
        throw e
    }
}

export async function updateSubject(
    me: DuoUser,
    id: string,
    action: 'answer' | 'unanswer' | 'prayed' | 'edit',
    extra: { title?: string; notes?: string } = {},
) {
    patchSubjects((list) =>
        list.map((s) => {
            if (s.id !== id) return s
            if (action === 'answer') return { ...s, answeredAt: new Date().toISOString() }
            if (action === 'unanswer') return { ...s, answeredAt: null }
            if (action === 'prayed') return { ...s, prayedCount: s.prayedCount + 1, lastPrayedAt: new Date().toISOString() }
            return { ...s, title: extra.title ?? s.title, notes: extra.notes ?? s.notes }
        }),
    )
    try {
        const updated = await send<PrayerSubject>('/api/prayer/subjects', 'PATCH', { id, userId: me, action, ...extra })
        patchSubjects((list) => list.map((s) => (s.id === id ? updated : s)))
    } catch (e) {
        globalMutate(KEYS.subjects)
        throw e
    }
}

export async function deleteSubject(me: DuoUser, id: string) {
    patchSubjects((list) => list.filter((s) => s.id !== id))
    try {
        await send('/api/prayer/subjects', 'DELETE', { id, userId: me })
    } catch (e) {
        globalMutate(KEYS.subjects)
        throw e
    }
}
