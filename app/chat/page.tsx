"use client"

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, Loader2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { bindChannel } from '@/lib/pusher'
import { clearNotifications } from '@/lib/notifications'
import {
    canEdit,
    deleteMessage,
    editMessage,
    fetchOlderMessages,
    hideForMe,
    markRead,
    reactToMessage,
    retryMessage,
    sendMessage,
    sendNudge,
    sendTyping,
    setMood,
    useDuo,
    useHiddenMessages,
    useMe,
    useMessages,
} from '@/lib/data'
import { dayLabel } from '@/lib/dates'
import { lastSeenLabel, useIsOnline } from '@/lib/presence'
import { useKeyboard } from '@/lib/keyboard'
import type { ChatMessage } from '@/lib/types'
import { Bubble } from '@/components/chat/Bubble'
import { Composer } from '@/components/chat/Composer'
import { ActionSheet } from '@/components/chat/ActionSheet'
import { ChatHeader } from '@/components/chat/ChatHeader'
import { PhotoViewer } from '@/components/chat/PhotoViewer'
import { SearchPanel } from '@/components/chat/SearchPanel'

const GROUP_GAP_MS = 3 * 60 * 1000
const PAGE = 50

export default function ChatPage() {
    const { ready, me, partner, partnerName } = useMe()
    const { data: latest, isLoading } = useMessages()
    const { data: members } = useDuo()
    const hidden = useHiddenMessages()
    const kb = useKeyboard()

    const [older, setOlder] = useState<ChatMessage[]>([])
    const [hasMore, setHasMore] = useState(true)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [partnerActivity, setPartnerActivity] = useState<null | 'typing' | 'recording'>(null)
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
    const [editing, setEditing] = useState<ChatMessage | null>(null)
    const [selected, setSelected] = useState<ChatMessage | null>(null)
    const [viewing, setViewing] = useState<ChatMessage | null>(null)
    const [searching, setSearching] = useState(false)
    const [highlight, setHighlight] = useState<string | null>(null)
    const [showJump, setShowJump] = useState(false)
    const [newWhileAway, setNewWhileAway] = useState(0)
    const listRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Newest first (the list renders with flex-col-reverse, so it opens at the bottom)
    const messages = useMemo(() => {
        const seen = new Set<string>()
        return [...(latest ?? []), ...older].filter((m) => !hidden.has(m.id) && (seen.has(m.id) ? false : (seen.add(m.id), true)))
    }, [latest, older, hidden])
    const messagesRef = useRef(messages)
    messagesRef.current = messages

    const partnerInfo = members?.find((u) => u.id === partner)
    const myInfo = members?.find((u) => u.id === me)

    // "N unread messages" divider: captured once, BEFORE the read receipt marks them read
    const [unreadMark, setUnreadMark] = useState<{ id: string; count: number } | null | undefined>(undefined)
    useEffect(() => {
        if (unreadMark !== undefined || !latest) return
        const unread = latest.filter((m) => m.senderId !== me && !m.readAt && !m.deleted)
        setUnreadMark(unread.length ? { id: unread[unread.length - 1].id, count: unread.length } : null)
    }, [latest, me, unreadMark])

    // Read receipts + clear OS notifications whenever the chat is on screen
    useEffect(() => {
        if (!ready || unreadMark === undefined) return
        const sync = () => {
            if (document.visibilityState !== 'visible') return
            markRead(me)
            clearNotifications('chat')
            clearNotifications('nudge')
        }
        sync()
        document.addEventListener('visibilitychange', sync)
        return () => document.removeEventListener('visibilitychange', sync)
    }, [ready, me, latest, unreadMark])

    // Open at the unread divider when there's more than a screenful of unread
    const openedAtDivider = useRef(false)
    useLayoutEffect(() => {
        if (openedAtDivider.current || !unreadMark) return
        openedAtDivider.current = true
        const el = listRef.current?.querySelector('[data-unread-divider]')
        const list = listRef.current
        if (el && list && el.getBoundingClientRect().top < list.getBoundingClientRect().top) el.scrollIntoView({ block: 'start' })
    }, [unreadMark])

    // Typing / recording indicator
    useEffect(() => {
        if (!ready) return
        let timer: ReturnType<typeof setTimeout> | undefined
        const unbind = bindChannel('bond-update', {
            typing: (d: { senderId: string; kind?: 'typing' | 'recording' }) => {
                if (d.senderId === me) return
                setPartnerActivity(d.kind === 'recording' ? 'recording' : 'typing')
                clearTimeout(timer)
                timer = setTimeout(() => setPartnerActivity(null), 3500)
            },
            'new-note': (m: ChatMessage) => {
                if (m.senderId !== me) setPartnerActivity(null)
            },
        })
        return () => {
            clearTimeout(timer)
            unbind()
        }
    }, [ready, me])

    const scrollToBottom = useCallback((smooth = false) => {
        listRef.current?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
        setNewWhileAway(0)
    }, [])

    // When I send, jump to the newest message; count partner messages while scrolled up
    const newestId = messages[0]?.id
    const newestMine = messages[0]?.senderId === me
    const prevNewest = useRef(newestId)
    useLayoutEffect(() => {
        if (newestId === prevNewest.current) return
        prevNewest.current = newestId
        if (newestMine) scrollToBottom()
        else if (showJump) setNewWhileAway((n) => n + 1)
    }, [newestId, newestMine, scrollToBottom, showJump])

    useEffect(() => {
        if (kb.open) scrollToBottom()
    }, [kb.open, kb.height, scrollToBottom])

    const onScroll = () => {
        const el = listRef.current
        if (!el) return
        // In a column-reverse list scrollTop is 0 at the bottom and negative going up
        const away = Math.abs(el.scrollTop) > 400
        setShowJump(away)
        if (!away) setNewWhileAway(0)
    }

    const loadOlder = async () => {
        const oldest = messages[messages.length - 1]
        if (!oldest || loadingOlder) return
        setLoadingOlder(true)
        try {
            const page = await fetchOlderMessages(oldest.createdAt)
            setOlder((prev) => [...prev, ...page])
            if (page.length < PAGE) setHasMore(false)
        } catch {
            toast.error('Couldn’t load earlier messages')
        } finally {
            setLoadingOlder(false)
        }
    }

    /** Scroll to a message (quoted reply / search result), loading history if needed */
    const jumpTo = async (id: string) => {
        if (!messagesRef.current.some((m) => m.id === id)) {
            const loaded: ChatMessage[] = []
            let oldest = messagesRef.current[messagesRef.current.length - 1]
            let more = hasMore
            const toastId = toast.loading('Finding message…')
            try {
                for (let i = 0; i < 20 && more && oldest && !loaded.some((m) => m.id === id); i++) {
                    const page = await fetchOlderMessages(oldest.createdAt)
                    loaded.push(...page)
                    if (page.length < PAGE) more = false
                    oldest = page[page.length - 1] ?? oldest
                }
            } finally {
                toast.dismiss(toastId)
            }
            if (loaded.length) setOlder((prev) => [...prev, ...loaded])
            if (!more) setHasMore(false)
            if (!loaded.some((m) => m.id === id)) {
                toast.error('That message is no longer available')
                return
            }
        }
        // Wait for the list to render the message, then centre and flash it
        requestAnimationFrame(() =>
            requestAnimationFrame(() => {
                const el = listRef.current?.querySelector(`[data-mid="${id}"]`)
                el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
                setHighlight(id)
                setTimeout(() => setHighlight(null), 1600)
            }),
        )
    }

    const partnerOnline = useIsOnline(partner)
    const statusText =
        partnerActivity === 'recording'
            ? 'recording audio…'
            : partnerActivity === 'typing'
                ? 'typing…'
                : partnerOnline
                    ? 'online'
                    : lastSeenLabel(partnerInfo?.lastSeenAt)

    const startReply = (m: ChatMessage) => {
        if (m.pending || m.failed || m.deleted) return
        setEditing(null)
        setReplyTo(m)
        inputRef.current?.focus()
    }

    return (
        <div
            className="relative mx-auto flex h-full w-full max-w-3xl flex-col bg-black"
            // While typing, pin the whole chat to the area above the keyboard.
            // (iOS scrolls the page instead of resizing it, which made the
            // header and tab bar jump around.)
            style={kb.open ? { position: 'fixed', left: 0, right: 0, top: kb.top, height: kb.height, zIndex: 60 } : undefined}
        >
            <ChatHeader
                partner={partner}
                partnerName={partnerName}
                partnerMoodEmoji={partnerInfo?.moodEmoji ?? null}
                status={statusText}
                active={!!partnerActivity}
                myMood={myInfo?.moodEmoji ?? null}
                onMood={(emoji, label) => setMood(me, emoji, label).catch(() => toast.error('Couldn’t set mood'))}
                onNudge={() => {
                    navigator.vibrate?.(20)
                    toast.success(`Sent ${partnerName} a nudge`)
                    sendNudge(me).catch(() => toast.error('Nudge failed'))
                }}
                onSearch={() => setSearching(true)}
            />

            <div className="relative min-h-0 flex-1">
                <div ref={listRef} onScroll={onScroll} className="flex h-full flex-col-reverse overflow-y-auto overscroll-contain px-3 py-3 md:px-6">
                    {partnerActivity && <TypingBubble />}

                    {messages.map((m, i) => {
                        const olderMsg = messages[i + 1]
                        const sameDayAsOlder = !!olderMsg && new Date(olderMsg.createdAt).toDateString() === new Date(m.createdAt).toDateString()
                        const tight =
                            sameDayAsOlder &&
                            olderMsg.senderId === m.senderId &&
                            new Date(m.createdAt).getTime() - new Date(olderMsg.createdAt).getTime() < GROUP_GAP_MS
                        return (
                            <Fragment key={m.clientId ?? m.id}>
                                <Bubble
                                    m={m}
                                    mine={m.senderId === me}
                                    me={me}
                                    tight={tight && unreadMark?.id !== m.id}
                                    highlighted={highlight === m.id}
                                    onOpen={() => setSelected(m)}
                                    onDoubleTap={() => !m.pending && !m.deleted && reactToMessage(me, m.id, '❤️').catch(() => { })}
                                    onRetry={() => retryMessage(me, m).catch(() => toast.error('Still not delivered'))}
                                    onViewImage={() => setViewing(m)}
                                    onSwipeReply={() => startReply(m)}
                                    onJumpTo={jumpTo}
                                />
                                {unreadMark?.id === m.id && (
                                    <div data-unread-divider className="my-3 flex justify-center">
                                        <span className="rounded-full bg-surface px-3 py-1 text-[12px] font-medium text-muted">
                                            {unreadMark.count} unread message{unreadMark.count === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                )}
                                {!sameDayAsOlder && <p className="mb-1 mt-5 text-center text-[12px] font-medium text-muted">{dayLabel(m.createdAt)}</p>}
                            </Fragment>
                        )
                    })}

                    {messages.length === 0 && (
                        <div className="m-auto flex flex-col items-center gap-2 py-16 text-center">
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-faint" /> : <p className="text-[15px] text-muted">No messages yet</p>}
                        </div>
                    )}

                    {messages.length >= PAGE && hasMore && (
                        <div className="flex justify-center py-2">
                            <button onClick={loadOlder} disabled={loadingOlder} className="px-4 py-1.5 text-[14px] text-accent">
                                {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                            </button>
                        </div>
                    )}
                </div>

                {showJump && (
                    <button
                        onClick={() => scrollToBottom(true)}
                        aria-label="Jump to latest"
                        className="absolute bottom-3 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-white shadow-lg ring-1 ring-line"
                    >
                        <ArrowDown className="h-5 w-5" />
                        {newWhileAway > 0 && (
                            <span className="absolute -top-1.5 left-1/2 flex h-[18px] min-w-[18px] -translate-x-1/2 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-semibold">
                                {newWhileAway}
                            </span>
                        )}
                    </button>
                )}

                {searching && (
                    <SearchPanel
                        me={me}
                        onClose={() => setSearching(false)}
                        onPick={(m) => {
                            setSearching(false)
                            jumpTo(m.id)
                        }}
                    />
                )}
            </div>

            <Composer
                inputRef={inputRef}
                replyTo={replyTo}
                editing={editing}
                onCancelReply={() => setReplyTo(null)}
                onCancelEdit={() => setEditing(null)}
                onTyping={(kind) => sendTyping(me, kind)}
                onSend={(text, image) => {
                    const reply = replyTo
                    setReplyTo(null)
                    sendMessage(me, text, reply, image).catch(() => toast.error('Not delivered — tap the message to retry'))
                }}
                onSendVoice={(voice) => {
                    const reply = replyTo
                    setReplyTo(null)
                    sendMessage(me, '', reply, undefined, voice).catch(() => toast.error('Voice message not delivered — tap it to retry'))
                }}
                onSaveEdit={(text) => {
                    const target = editing
                    setEditing(null)
                    if (target) editMessage(me, target.id, text).catch((e) => toast.error(e instanceof Error ? e.message : 'Couldn’t edit'))
                }}
            />

            {viewing?.image && (
                <PhotoViewer
                    m={viewing}
                    mine={viewing.senderId === me}
                    onClose={() => setViewing(null)}
                    onReply={() => {
                        startReply(viewing)
                        setViewing(null)
                    }}
                    onMore={() => {
                        setSelected(viewing)
                        setViewing(null)
                    }}
                />
            )}

            {selected && (
                <ActionSheet
                    m={selected}
                    mine={selected.senderId === me}
                    myReaction={selected.reactions[me]}
                    canEdit={canEdit(selected, me)}
                    onClose={() => setSelected(null)}
                    onReact={(emoji) => {
                        setSelected(null)
                        reactToMessage(me, selected.id, emoji).catch(() => toast.error('Couldn’t react'))
                    }}
                    onReply={() => {
                        startReply(selected)
                        setSelected(null)
                    }}
                    onCopy={() => {
                        navigator.clipboard?.writeText(selected.content).then(() => toast.success('Copied'))
                        setSelected(null)
                    }}
                    onEdit={() => {
                        setReplyTo(null)
                        setEditing(selected)
                        setSelected(null)
                    }}
                    onDeleteForMe={() => {
                        hideForMe(selected.id)
                        setSelected(null)
                    }}
                    onDeleteForEveryone={() => {
                        const id = selected.id
                        setSelected(null)
                        deleteMessage(me, id).catch(() => toast.error('Couldn’t delete'))
                    }}
                />
            )}
        </div>
    )
}

function TypingBubble() {
    return (
        <div className="mt-3 flex items-start">
            <div className="flex items-center gap-1 rounded-[18px] bg-surface-2 px-3.5 py-3">
                {[0, 150, 300].map((d) => (
                    <span key={d} className="h-[7px] w-[7px] animate-pulse rounded-full bg-muted" style={{ animationDelay: `${d}ms` }} />
                ))}
            </div>
        </div>
    )
}
