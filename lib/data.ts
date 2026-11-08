"use client"

// Data hooks + actions. All screens read from the same SWR keys, which the
// RealtimeProvider keeps fresh from Pusher events, so switching tabs is instant.

import { useSyncExternalStore } from 'react'
import useSWR from 'swr'
import { appMutate as globalMutate, patchCache } from './swr-mutate'
import { handleUnauthorized, useIdentity } from './identity'
import { getUserName, type DuoUser } from './constants'
import { todayKey } from './dates'
import type { ChatMessage, DuoMember, PrayerSubject, PrayerSummary } from './types'
import { uploadImage, type PreparedImage } from './images'
import type { RecordedVoice } from './voice'

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
    if (res.status === 401) handleUnauthorized()
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
    const { currentId, signOut } = useIdentity()
    const me: DuoUser = currentId ?? 'user-1'
    const partner: DuoUser = me === 'user-1' ? 'user-2' : 'user-1'
    return {
        ready: currentId !== null,
        me,
        partner,
        meName: getUserName(me),
        partnerName: getUserName(partner),
        signOut,
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

function preload(url: string) {
    return new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = img.onerror = () => resolve()
        img.src = url
        setTimeout(resolve, 4000)
    })
}

// Media of messages that are still uploading (kept so a failed send can be retried)
const pendingMedia = new Map<string, { image?: PreparedImage; voice?: RecordedVoice }>()

export async function sendMessage(
    me: DuoUser,
    content: string,
    replyTo: ChatMessage | null,
    image?: PreparedImage,
    voice?: RecordedVoice,
) {
    const clientId = `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    if (image || voice) pendingMedia.set(clientId, { image, voice })
    const optimistic: ChatMessage = {
        id: clientId,
        clientId,
        content,
        senderId: me,
        senderName: getUserName(me),
        createdAt: new Date().toISOString(),
        replyToId: replyTo?.id ?? null,
        replyTo: replyTo ? quoteOf(replyTo) : null,
        readAt: null,
        deliveredAt: null,
        reactions: {},
        // Show the local copy instantly; replaced by the uploaded URL once sent
        image: image ? { id: 'local', url: image.previewUrl, width: image.width, height: image.height } : null,
        audio: voice ? { id: 'local', url: voice.url, durationMs: voice.durationMs, waveform: voice.waveform } : null,
        pending: true,
    }
    patchMessages((list) => upsertMessage(list, optimistic))
    try {
        // Photo / voice: upload the file and create the message in ONE request
        const { message } =
            image || voice
                ? await sendWithMedia(me, { content, replyToId: replyTo?.id, clientId }, image, voice)
                : await send<{ message: ChatMessage }>('/api/messages', 'POST', {
                    senderId: me,
                    content,
                    replyToId: replyTo?.id,
                    clientId,
                })
        // Swap the local preview for the uploaded URL once that has loaded (no flicker).
        // The cache is persisted, so a blob: URL must never stay in it.
        if (message.image) await preload(message.image.url)
        patchMessages((list) => upsertMessage(list, { ...message, clientId }))
        pendingMedia.delete(clientId)
    } catch (e) {
        patchMessages((list) => list.map((m) => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m)))
        throw e
    }
}

async function sendWithMedia(
    me: DuoUser,
    fields: { content: string; replyToId?: string; clientId: string },
    image?: PreparedImage,
    voice?: RecordedVoice,
): Promise<{ message: ChatMessage }> {
    const form = new FormData()
    form.append('senderId', me)
    form.append('content', fields.content)
    form.append('clientId', fields.clientId)
    if (fields.replyToId) form.append('replyToId', fields.replyToId)
    if (voice) {
        form.append('file', voice.blob, `voice.${voice.mime.includes('mp4') ? 'm4a' : 'webm'}`)
        form.append('duration', String(Math.round(voice.durationMs)))
        form.append('wave', voice.waveform.join(','))
    } else if (image) {
        form.append('file', image.blob, 'photo.jpg')
        form.append('w', String(image.width))
        form.append('h', String(image.height))
    }
    const res = await fetch('/api/images', { method: 'POST', body: form })
    if (!res.ok) throw new Error(res.status === 413 ? 'That file is too large' : 'Couldn’t send — check your connection')
    const data = (await res.json()) as { message: ChatMessage | null }
    if (!data.message) throw new Error('Couldn’t send')
    return { message: data.message }
}

/** What a reply bubble shows about the message it quotes */
export function quoteOf(m: ChatMessage): NonNullable<ChatMessage['replyTo']> {
    return {
        id: m.id,
        content: m.deleted ? 'Deleted message' : m.content.slice(0, 120) || (m.image ? 'Photo' : m.audio ? 'Voice message' : ''),
        senderId: m.senderId,
        senderName: m.senderName,
        imageUrl: m.image && !m.image.url.startsWith('blob:') ? m.image.url : null,
    }
}

export async function retryMessage(me: DuoUser, msg: ChatMessage) {
    const media = msg.clientId ? pendingMedia.get(msg.clientId) : undefined
    if (msg.clientId) pendingMedia.delete(msg.clientId)
    patchMessages((list) => list.filter((m) => m.clientId !== msg.clientId))
    const reply = msg.replyTo ? ({ ...msg.replyTo, image: null, audio: null, deleted: false } as unknown as ChatMessage) : null
    await sendMessage(me, msg.content, reply, media?.image, media?.voice)
}

/** Edit my own text message (server allows 15 minutes) */
export const EDIT_WINDOW_MS = 15 * 60 * 1000
export function canEdit(m: ChatMessage, me: DuoUser) {
    return m.senderId === me && !m.deleted && !m.audio && !m.pending && !m.failed && Date.now() - new Date(m.createdAt).getTime() < EDIT_WINDOW_MS
}

export async function editMessage(me: DuoUser, id: string, content: string) {
    const before = await patchMessages((list) => list)
    patchMessages((list) => list.map((m) => (m.id === id ? { ...m, content, editedAt: new Date().toISOString() } : m)))
    try {
        const { message } = await send<{ message: ChatMessage }>('/api/messages', 'PATCH', { messageId: id, senderId: me, content })
        patchMessages((list) => upsertMessage(list, message))
    } catch (e) {
        if (before) globalMutate(KEYS.messages, before, { revalidate: false })
        throw e
    }
}

export async function setProfilePhoto(me: DuoUser, image: PreparedImage | null) {
    const url = image ? (await uploadImage(me, image)).url : null
    await send('/api/duo', 'POST', { userId: me, image: url })
    await globalMutate(KEYS.duo)
}

/** Turn a message into the "This message was deleted" placeholder */
export const asDeleted = (m: ChatMessage): ChatMessage => ({ ...m, deleted: true, content: '', image: null, audio: null, reactions: {} })

/** Delete for everyone (my own messages) */
export async function deleteMessage(me: DuoUser, id: string) {
    const before = await patchMessages((list) => list) // snapshot for rollback
    patchMessages((list) => list.map((m) => (m.id === id ? asDeleted(m) : m)))
    try {
        await send('/api/messages', 'DELETE', { messageId: id, senderId: me })
    } catch (e) {
        if (before) globalMutate(KEYS.messages, before, { revalidate: false })
        throw e
    }
}

// "Delete for me": hidden on this device only
const HIDDEN_KEY = 'duo-hidden-messages'
const hiddenListeners = new Set<() => void>()
let hiddenCache: Set<string> | null = null
function readHidden() {
    if (!hiddenCache) {
        try {
            hiddenCache = new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'))
        } catch {
            hiddenCache = new Set()
        }
    }
    return hiddenCache
}
export function hideForMe(id: string) {
    const next = new Set(readHidden()).add(id)
    hiddenCache = next
    try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next].slice(-2000)))
    } catch { }
    hiddenListeners.forEach((l) => l())
}
export function useHiddenMessages() {
    return useSyncExternalStore(
        (cb) => {
            hiddenListeners.add(cb)
            return () => hiddenListeners.delete(cb)
        },
        readHidden,
        () => EMPTY_SET,
    )
}
const EMPTY_SET = new Set<string>()

let lastDeliveredPost = 0
/** Tell the server my phone received the partner's messages (sender sees ✓✓) */
export function markDelivered(me: DuoUser, list: ChatMessage[] | undefined) {
    if (!list?.some((m) => m.senderId !== me && !m.deliveredAt && !m.readAt)) return
    if (Date.now() - lastDeliveredPost < 2000) return
    lastDeliveredPost = Date.now()
    send('/api/messages/delivered', 'POST', { userId: me }).catch(() => { })
}

export async function searchMessages(q: string) {
    const res = await fetch(`/api/messages/search?q=${encodeURIComponent(q)}`)
    if (!res.ok) throw new Error('Search failed')
    return (await res.json()) as ChatMessage[]
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
    return (list ?? []).filter((m) => m.senderId !== me && !m.readAt && !m.deleted).length
}

const lastTyping = { t: 0 }
export function sendTyping(me: DuoUser, kind: 'typing' | 'recording' = 'typing') {
    if (Date.now() - lastTyping.t < 2500) return
    lastTyping.t = Date.now()
    send('/api/bond/nudge', 'POST', { senderId: me, type: kind }).catch(() => { })
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
