"use client"

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, CornerUpLeft, Hand, Loader2, Smile, Trash2, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Avatar } from '@/components/ui/Page'
import { bindChannel } from '@/lib/pusher'
import { clearNotifications } from '@/lib/notifications'
import {
    deleteMessage,
    fetchOlderMessages,
    markRead,
    reactToMessage,
    retryMessage,
    sendMessage,
    sendNudge,
    sendTyping,
    setMood,
    useDuo,
    useMe,
    useMessages,
} from '@/lib/data'
import { dayLabel, timeLabel } from '@/lib/dates'
import { MOOD_OPTIONS, QUICK_EMOJIS, REACTION_EMOJIS } from '@/lib/moods'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/types'

const GROUP_GAP_MS = 3 * 60 * 1000

export default function ChatPage() {
    const { ready, me, partner, partnerName } = useMe()
    const { data: latest, isLoading } = useMessages()
    const { data: members } = useDuo()

    const [older, setOlder] = useState<ChatMessage[]>([])
    const [hasMore, setHasMore] = useState(true)
    const [loadingOlder, setLoadingOlder] = useState(false)
    const [partnerTyping, setPartnerTyping] = useState(false)
    const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)
    const [selected, setSelected] = useState<ChatMessage | null>(null)
    const [showJump, setShowJump] = useState(false)
    const listRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Newest first (the list renders with flex-col-reverse, so it opens at the bottom)
    const messages = useMemo(() => {
        const seen = new Set<string>()
        return [...(latest ?? []), ...older].filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)))
    }, [latest, older])

    const partnerMood = members?.find((u) => u.id === partner)
    const myMood = members?.find((u) => u.id === me)

    // Read receipts + clear OS notifications whenever the chat is on screen
    useEffect(() => {
        if (!ready) return
        const sync = () => {
            if (document.visibilityState !== 'visible') return
            markRead(me)
            clearNotifications('chat')
            clearNotifications('nudge')
        }
        sync()
        document.addEventListener('visibilitychange', sync)
        return () => document.removeEventListener('visibilitychange', sync)
    }, [ready, me, latest])

    // Typing indicator (page-level; the rest of realtime lives in RealtimeProvider)
    useEffect(() => {
        if (!ready) return
        let timer: ReturnType<typeof setTimeout> | undefined
        const unbind = bindChannel('bond-update', {
            typing: (d: { senderId: string }) => {
                if (d.senderId === me) return
                setPartnerTyping(true)
                clearTimeout(timer)
                timer = setTimeout(() => setPartnerTyping(false), 3500)
            },
            'new-note': (m: ChatMessage) => {
                if (m.senderId !== me) setPartnerTyping(false)
            },
        })
        return () => {
            clearTimeout(timer)
            unbind()
        }
    }, [ready, me])

    const scrollToBottom = useCallback((smooth = false) => {
        listRef.current?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
    }, [])

    // When I send, jump to the newest message
    const newestId = messages[0]?.id
    const newestMine = messages[0]?.senderId === me
    useLayoutEffect(() => {
        if (newestMine) scrollToBottom()
    }, [newestId, newestMine, scrollToBottom])

    const onScroll = () => {
        const el = listRef.current
        if (!el) return
        // In a column-reverse list scrollTop is 0 at the bottom and negative going up
        setShowJump(Math.abs(el.scrollTop) > 400)
    }

    const loadOlder = async () => {
        const oldest = messages[messages.length - 1]
        if (!oldest || loadingOlder) return
        setLoadingOlder(true)
        try {
            const page = await fetchOlderMessages(oldest.createdAt)
            setOlder((prev) => [...prev, ...page])
            if (page.length < 50) setHasMore(false)
        } catch {
            toast.error('Could not load earlier messages')
        } finally {
            setLoadingOlder(false)
        }
    }

    const statusText = partnerTyping
        ? 'typing…'
        : partnerMood?.moodEmoji
            ? `${partnerMood.moodEmoji} ${partnerMood.moodLabel ?? ''}`
            : ''

    return (
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col">
            <ChatHeader
                partner={partner}
                partnerName={partnerName}
                status={statusText}
                typing={partnerTyping}
                myMood={myMood?.moodEmoji ?? null}
                onMood={(emoji, label) => setMood(me, emoji, label).catch(() => toast.error('Could not set mood'))}
                onNudge={() => {
                    if ('vibrate' in navigator) navigator.vibrate?.(20)
                    toast.success(`Sent ${partnerName} a nudge`)
                    sendNudge(me).catch(() => toast.error('Nudge failed'))
                }}
            />

            <div className="relative min-h-0 flex-1">
                <div
                    ref={listRef}
                    onScroll={onScroll}
                    className="flex h-full flex-col-reverse overflow-y-auto overscroll-contain px-3 py-3 md:px-6"
                >
                    {partnerTyping && <TypingBubble />}

                    {messages.map((m, i) => {
                        const newer = messages[i - 1]
                        const olderMsg = messages[i + 1]
                        const sameDayAsOlder = olderMsg && new Date(olderMsg.createdAt).toDateString() === new Date(m.createdAt).toDateString()
                        const groupedWithNewer =
                            !!newer &&
                            newer.senderId === m.senderId &&
                            new Date(newer.createdAt).getTime() - new Date(m.createdAt).getTime() < GROUP_GAP_MS &&
                            new Date(newer.createdAt).toDateString() === new Date(m.createdAt).toDateString()
                        const groupedWithOlder =
                            !!olderMsg &&
                            sameDayAsOlder &&
                            olderMsg.senderId === m.senderId &&
                            new Date(m.createdAt).getTime() - new Date(olderMsg.createdAt).getTime() < GROUP_GAP_MS
                        const isMyNewest = m.senderId === me && messages.findIndex((x) => x.senderId === me) === i

                        return (
                            <Fragment key={m.clientId ?? m.id}>
                                <Bubble
                                    m={m}
                                    mine={m.senderId === me}
                                    me={me}
                                    showTime={!groupedWithNewer}
                                    tight={groupedWithOlder}
                                    status={isMyNewest ? (m.failed ? 'failed' : m.pending ? 'sending' : m.readAt ? 'seen' : 'sent') : null}
                                    onOpen={() => setSelected(m)}
                                    onDoubleTap={() => !m.pending && reactToMessage(me, m.id, '❤️').catch(() => { })}
                                    onRetry={() => retryMessage(me, m).catch(() => toast.error('Still failing to send'))}
                                />
                                {!sameDayAsOlder && (
                                    <p className="mb-1 mt-5 text-center text-[12px] font-medium text-muted">{dayLabel(m.createdAt)}</p>
                                )}
                            </Fragment>
                        )
                    })}

                    {messages.length === 0 && (
                        <div className="m-auto flex flex-col items-center gap-2 py-16 text-center">
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin text-faint" />
                            ) : (
                                <p className="text-[15px] text-muted">No messages yet</p>
                            )}
                        </div>
                    )}

                    {messages.length >= 50 && hasMore && (
                        <div className="flex justify-center py-2">
                            <button
                                onClick={loadOlder}
                                disabled={loadingOlder}
                                className="px-4 py-1.5 text-[14px] text-accent"
                            >
                                {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                            </button>
                        </div>
                    )}
                </div>

                {showJump && (
                    <button
                        onClick={() => scrollToBottom(true)}
                        aria-label="Jump to latest"
                        className="absolute bottom-3 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2 text-white shadow-lg ring-1 ring-line"
                    >
                        <ArrowDown className="h-5 w-5" />
                    </button>
                )}
            </div>

            <Composer
                inputRef={inputRef}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                onTyping={() => sendTyping(me)}
                onSend={(text) => {
                    const reply = replyTo
                    setReplyTo(null)
                    sendMessage(me, text, reply).catch(() => toast.error('Not delivered — tap the message to retry'))
                }}
            />

            {selected && (
                <ActionSheet
                    m={selected}
                    mine={selected.senderId === me}
                    myReaction={selected.reactions[me]}
                    onClose={() => setSelected(null)}
                    onReact={(emoji) => {
                        setSelected(null)
                        reactToMessage(me, selected.id, emoji).catch(() => toast.error('Could not react'))
                    }}
                    onReply={() => {
                        setReplyTo(selected)
                        setSelected(null)
                        inputRef.current?.focus()
                    }}
                    onCopy={() => {
                        navigator.clipboard?.writeText(selected.content).then(() => toast.success('Copied'))
                        setSelected(null)
                    }}
                    onDelete={() => {
                        const id = selected.id
                        setSelected(null)
                        deleteMessage(me, id).catch(() => toast.error('Could not delete'))
                    }}
                />
            )}
        </div>
    )
}

// ------------------------------------------------------------------ Header

function ChatHeader({
    partner,
    partnerName,
    status,
    typing,
    myMood,
    onMood,
    onNudge,
}: {
    partner: string
    partnerName: string
    status: string
    typing: boolean
    myMood: string | null
    onMood: (emoji: string | null, label: string | null) => void
    onNudge: () => void
}) {
    const [moodOpen, setMoodOpen] = useState(false)
    return (
        <header className="relative z-20 flex shrink-0 items-center gap-3 border-b border-line bg-black/90 px-4 py-2 backdrop-blur-lg md:px-6">
            <Avatar name={partnerName} user={partner} />
            <div className="min-w-0 flex-1">
                <h1 className="truncate text-[17px] font-semibold leading-tight">{partnerName}</h1>
                {status && <p className={cn('truncate text-[13px]', typing ? 'text-accent' : 'text-muted')}>{status}</p>}
            </div>
            <div className="relative">
                <button
                    onClick={() => setMoodOpen((o) => !o)}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-lg active:bg-surface"
                    aria-label="Set your mood"
                    title="Set your mood"
                >
                    {myMood ?? <Smile className="h-[22px] w-[22px] text-accent" strokeWidth={1.8} />}
                </button>
                {moodOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setMoodOpen(false)} />
                        <div className="absolute right-0 top-12 z-20 w-64 rounded-2xl bg-surface-2 p-2 shadow-2xl ring-1 ring-line">
                            <p className="mb-1 px-2 pt-1 text-[13px] text-muted">Your mood</p>
                            <div className="grid grid-cols-4 gap-1">
                                {MOOD_OPTIONS.map((m) => (
                                    <button
                                        key={m.label}
                                        onClick={() => {
                                            onMood(m.emoji, m.label)
                                            setMoodOpen(false)
                                        }}
                                        className={cn('flex flex-col items-center gap-0.5 rounded-xl p-2 active:bg-line', myMood === m.emoji && 'bg-line')}
                                    >
                                        <span className="text-xl">{m.emoji}</span>
                                        <span className="text-[10px] leading-tight text-muted">{m.label}</span>
                                    </button>
                                ))}
                            </div>
                            {myMood && (
                                <button
                                    onClick={() => {
                                        onMood(null, null)
                                        setMoodOpen(false)
                                    }}
                                    className="mt-1 w-full rounded-xl py-2 text-[14px] text-accent"
                                >
                                    Clear mood
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>
            <button
                onClick={onNudge}
                className="flex h-10 w-10 items-center justify-center rounded-full text-accent active:bg-surface"
                aria-label="Nudge"
                title="Nudge"
            >
                <Hand className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </button>
        </header>
    )
}

// ------------------------------------------------------------------ Bubble

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️|\s)+$/u
const URL_RE = /(https?:\/\/[^\s]+)/g

function renderText(text: string) {
    return text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
            <a key={i} href={part} target="_blank" rel="noreferrer" className="underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
                {part}
            </a>
        ) : (
            <Fragment key={i}>{part}</Fragment>
        ),
    )
}

function Bubble({
    m,
    mine,
    me,
    showTime,
    tight,
    status,
    onOpen,
    onDoubleTap,
    onRetry,
}: {
    m: ChatMessage
    mine: boolean
    me: string
    showTime: boolean
    tight: boolean
    status: 'sending' | 'sent' | 'seen' | 'failed' | null
    onOpen: () => void
    onDoubleTap: () => void
    onRetry: () => void
}) {
    const lastTap = useRef(0)
    const emojiOnly = m.content.length <= 16 && EMOJI_ONLY.test(m.content)
    const reactions = Object.entries(m.reactions ?? {})

    const handleClick = () => {
        if (m.failed) return onRetry()
        const now = Date.now()
        if (now - lastTap.current < 280) {
            lastTap.current = 0
            onDoubleTap()
            return
        }
        lastTap.current = now
        setTimeout(() => {
            if (lastTap.current === now) onOpen()
        }, 290)
    }

    return (
        <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start', tight ? 'mt-0.5' : 'mt-3')}>
            <div className={cn('max-w-[80%] md:max-w-[65%]', reactions.length && 'mb-3.5')}>
                <button
                    type="button"
                    onClick={handleClick}
                    onContextMenu={(e) => {
                        e.preventDefault()
                        onOpen()
                    }}
                    className={cn(
                        'relative block w-full select-text text-left transition-opacity',
                        m.pending && 'opacity-70',
                        emojiOnly
                            ? 'px-1 text-5xl leading-tight'
                            : cn(
                                'rounded-[18px] px-3 py-[7px] text-[16px] leading-[21px]',
                                mine ? 'bg-accent text-white' : 'bg-surface-2 text-white',
                                mine ? (tight ? 'rounded-tr-md' : '') : tight ? 'rounded-tl-md' : '',
                                m.failed && 'bg-surface-2 ring-1 ring-[#ff453a]',
                            ),
                    )}
                >
                    {m.replyTo && !emojiOnly && (
                        <span
                            className={cn(
                                'mb-1 block rounded-lg border-l-[3px] px-2 py-1 text-[13px] leading-snug',
                                mine ? 'border-white/70 bg-black/15 text-white/85' : 'border-accent bg-black/25 text-white/75',
                            )}
                        >
                            <span className="block font-semibold">{m.replyTo.senderId === me ? 'You' : m.replyTo.senderName}</span>
                            <span className="line-clamp-2">{m.replyTo.content}</span>
                        </span>
                    )}
                    <span className="whitespace-pre-wrap break-words">{renderText(m.content)}</span>

                    {reactions.length > 0 && (
                        <span
                            className={cn(
                                'absolute -bottom-3.5 flex items-center gap-0.5 rounded-full border-2 border-black bg-surface-2 px-1.5 py-px text-[13px]',
                                mine ? 'right-2' : 'left-2',
                            )}
                        >
                            {reactions.map(([u, e]) => <span key={u}>{e}</span>)}
                        </span>
                    )}
                </button>
            </div>

            {(showTime || status) && (
                <span className={cn('mt-1 px-1 text-[11px] text-muted', status === 'failed' && 'text-[#ff453a]')}>
                    {status === 'failed'
                        ? 'Not delivered · tap to retry'
                        : status === 'sending'
                            ? 'Sending…'
                            : `${timeLabel(m.createdAt)}${status === 'seen' ? ' · Read' : status === 'sent' ? ' · Delivered' : ''}`}
                </span>
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

// ------------------------------------------------------------------ Composer

function Composer({
    inputRef,
    replyTo,
    onCancelReply,
    onTyping,
    onSend,
}: {
    inputRef: React.RefObject<HTMLTextAreaElement | null>
    replyTo: ChatMessage | null
    onCancelReply: () => void
    onTyping: () => void
    onSend: (text: string) => void
}) {
    const [text, setText] = useState('')
    const [emojiOpen, setEmojiOpen] = useState(false)

    const resize = () => {
        const el = inputRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`
    }

    const submit = (value = text) => {
        const t = value.trim()
        if (!t) return
        onSend(t)
        setText('')
        requestAnimationFrame(resize)
        inputRef.current?.focus()
    }

    return (
        <div className="shrink-0 border-t border-line bg-black/90 px-2 pb-2 pt-2 backdrop-blur-lg md:px-6">
            {replyTo && (
                <div className="mb-2 ml-1 flex items-center gap-2 border-l-[3px] border-accent pl-3 pr-2">
                                        <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-accent">Replying to {replyTo.senderName}</p>
                        <p className="truncate text-[13px] text-muted">{replyTo.content}</p>
                    </div>
                    <button onClick={onCancelReply} aria-label="Cancel reply" className="text-muted">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}
            {emojiOpen && (
                <div className="mb-2 flex justify-between gap-1 px-1">
                    {QUICK_EMOJIS.map((e) => (
                        <button
                            key={e}
                            onClick={() => {
                                submit(e)
                                setEmojiOpen(false)
                            }}
                            className="flex h-10 flex-1 items-center justify-center rounded-xl text-2xl active:scale-90"
                        >
                            {e}
                        </button>
                    ))}
                </div>
            )}
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    submit()
                }}
                className="flex items-end gap-2"
            >
                <button
                    type="button"
                    onClick={() => setEmojiOpen((o) => !o)}
                    aria-label="Quick emoji"
                    className={cn('mb-[3px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted', emojiOpen && 'text-accent')}
                >
                    <Smile className="h-6 w-6" strokeWidth={1.7} />
                </button>
                <textarea
                    ref={inputRef}
                    value={text}
                    rows={1}
                    onChange={(e) => {
                        setText(e.target.value)
                        resize()
                        if (e.target.value) onTyping()
                    }}
                    onKeyDown={(e) => {
                        const coarse = window.matchMedia?.('(pointer: coarse)').matches
                        if (e.key === 'Enter' && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                            submit()
                        }
                    }}
                    placeholder="Message"
                    className="max-h-[140px] min-h-[38px] flex-1 resize-none rounded-[19px] border border-line bg-black px-3.5 py-[7px] text-[16px] leading-[22px] text-white placeholder:text-faint focus:outline-none"
                />
                <button
                    type="submit"
                    aria-label="Send"
                    disabled={!text.trim()}
                    onMouseDown={(e) => e.preventDefault() /* keep keyboard open */}
                    className="mb-[3px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white active:opacity-80 disabled:bg-surface-2 disabled:text-faint"
                >
                    <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.6} />
                </button>
            </form>
        </div>
    )
}

// ------------------------------------------------------------------ Actions

function ActionSheet({
    m,
    mine,
    myReaction,
    onClose,
    onReact,
    onReply,
    onCopy,
    onDelete,
}: {
    m: ChatMessage
    mine: boolean
    myReaction?: string
    onClose: () => void
    onReact: (emoji: string) => void
    onReply: () => void
    onCopy: () => void
    onDelete: () => void
}) {
    const [confirmDelete, setConfirmDelete] = useState(false)
    const disabled = !!m.pending || !!m.failed
    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center" onClick={onClose}>
            <div
                className="w-full max-w-md rounded-t-2xl bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <p className="mb-3 line-clamp-3 px-2 pt-1 text-[14px] text-muted">{m.content}</p>
                {!disabled && (
                    <div className="mb-3 flex justify-between rounded-xl bg-surface-2 p-1.5">
                        {REACTION_EMOJIS.map((e) => (
                            <button
                                key={e}
                                onClick={() => onReact(e)}
                                className={cn('flex h-11 w-11 items-center justify-center rounded-full text-2xl active:bg-line', myReaction === e && 'bg-line')}
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                )}
                <div className="overflow-hidden rounded-xl bg-surface-2 [&>*+*]:border-t [&>*+*]:border-line">
                    {!disabled && <SheetItem icon={<CornerUpLeft className="h-5 w-5" />} label="Reply" onClick={onReply} />}
                    <SheetItem icon={<Copy className="h-5 w-5" />} label="Copy text" onClick={onCopy} />
                    {mine && !disabled && (
                        confirmDelete ? (
                            <SheetItem icon={<Trash2 className="h-5 w-5" />} label="Delete for both of you" danger onClick={onDelete} />
                        ) : (
                            <SheetItem icon={<Trash2 className="h-5 w-5" />} label="Delete" danger onClick={() => setConfirmDelete(true)} />
                        )
                    )}
                </div>
            </div>
        </div>
    )
}

function SheetItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left text-[16px] active:bg-line',
                danger ? 'text-[#ff453a]' : 'text-white',
            )}
        >
            {icon}
            {label}
        </button>
    )
}
