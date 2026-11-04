"use client"

import { useRef, useState } from 'react'
import { Ban, Check, CheckCheck, Clock, CornerUpLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { timeLabel } from '@/lib/dates'
import type { ChatMessage } from '@/lib/types'
import { isEmojiOnly, renderText } from './format'
import { VoiceNote } from './VoiceNote'

type Props = {
    m: ChatMessage
    mine: boolean
    me: string
    /** Same sender, within a few minutes of the previous (older) message */
    tight: boolean
    highlighted: boolean
    onOpen: () => void
    onDoubleTap: () => void
    onRetry: () => void
    onViewImage: () => void
    onSwipeReply: () => void
    onJumpTo: (id: string) => void
}

export function Bubble({ m, mine, me, tight, highlighted, onOpen, onDoubleTap, onRetry, onViewImage, onSwipeReply, onJumpTo }: Props) {
    const lastTap = useRef(0)
    const swipe = useSwipeToReply(onSwipeReply, !m.deleted && !m.pending && !m.failed)
    const image = m.image
    const audio = m.audio
    const emojiOnly = !image && !audio && !m.deleted && isEmojiOnly(m.content)
    const reactions = Object.entries(m.reactions ?? {})
    const hasText = !!m.content && !m.deleted
    const plain = !image && !audio && !m.deleted // text-only bubble

    const handleClick = () => {
        if (swipe.consumeClick()) return
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

    // Time + edited + ticks, WhatsApp-style
    const meta = (overlay = false) => (
        <span
            className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap text-[11px] leading-none',
                overlay ? 'rounded-full bg-black/45 px-1.5 py-1 text-white' : mine && !emojiOnly ? 'text-white/70' : 'text-muted',
            )}
        >
            {m.editedAt && !m.deleted && <span>Edited</span>}
            {timeLabel(m.createdAt)}
            {mine && !m.deleted && <Ticks m={m} light={overlay || !emojiOnly} />}
        </span>
    )

    const bubbleColor = mine ? 'bg-accent text-white' : 'bg-surface-2 text-white'

    return (
        <div
            data-mid={m.id}
            className={cn('relative flex touch-pan-y flex-col', mine ? 'items-end' : 'items-start', tight ? 'mt-[3px]' : 'mt-2.5')}
            {...swipe.handlers}
        >
            {/* Reply arrow revealed while swiping right */}
            <span
                aria-hidden
                className="pointer-events-none absolute left-1 top-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-white"
                style={{ opacity: Math.min(1, swipe.dx / 60), transform: `translateY(-50%) scale(${0.6 + Math.min(1, swipe.dx / 60) * 0.4})` }}
            >
                <CornerUpLeft className="h-4 w-4" />
            </span>

            <div
                className={cn('max-w-[80%] md:max-w-[65%]', reactions.length && 'mb-3.5')}
                style={{
                    transform: swipe.dx ? `translateX(${swipe.dx}px)` : undefined,
                    transition: swipe.dragging ? 'none' : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
            >
                <div
                    role="button"
                    tabIndex={0}
                    onClick={handleClick}
                    onKeyDown={(e) => e.key === 'Enter' && onOpen()}
                    onContextMenu={(e) => {
                        e.preventDefault()
                        onOpen()
                    }}
                    className={cn(
                        'relative select-text text-left outline-none transition-[opacity,box-shadow] duration-500',
                        m.pending && 'opacity-70',
                        highlighted && 'ring-2 ring-white/70 ring-offset-2 ring-offset-black',
                        m.deleted
                            ? 'rounded-[18px] border border-line px-3 py-[7px] text-[15px] italic text-muted'
                            : emojiOnly
                                ? 'rounded-[18px] px-1 text-5xl leading-tight'
                                : cn('rounded-[18px]', bubbleColor, mine ? tight && 'rounded-tr-md' : tight && 'rounded-tl-md'),
                        plain && !emojiOnly && 'px-3 py-[7px] text-[16px] leading-[21px]',
                        audio && 'px-2.5 py-2',
                        image && !hasText && !m.replyTo && 'bg-transparent',
                        m.failed && 'ring-1 ring-[#ff453a]',
                    )}
                >
                    {m.replyTo && !m.deleted && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                onJumpTo(m.replyTo!.id)
                            }}
                            className={cn(
                                'mb-1 flex w-full items-stretch gap-2 overflow-hidden rounded-lg border-l-[3px] text-left text-[13px] leading-snug',
                                mine ? 'border-white/70 bg-black/15 text-white/85' : 'border-accent bg-black/25 text-white/75',
                                (image || audio) && 'mt-0',
                                image && 'mx-1 mt-1 w-auto',
                            )}
                        >
                            <span className="min-w-0 flex-1 px-2 py-1">
                                <span className="block font-semibold">{m.replyTo.senderId === me ? 'You' : m.replyTo.senderName}</span>
                                <span className="line-clamp-2">{m.replyTo.content}</span>
                            </span>
                            {m.replyTo.imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element -- quoted photo thumbnail
                                <img src={m.replyTo.imageUrl} alt="" className="h-12 w-12 shrink-0 object-cover" />
                            )}
                        </button>
                    )}

                    {m.deleted && (
                        <span className="flex items-center gap-1.5">
                            <Ban className="h-4 w-4 shrink-0" />
                            {mine ? 'You deleted this message' : 'This message was deleted'}
                            <span className="ml-2 not-italic">{meta()}</span>
                        </span>
                    )}

                    {image && (
                        <span
                            className={cn('relative block overflow-hidden', hasText || m.replyTo ? 'm-[3px] rounded-[16px]' : 'rounded-[18px]')}
                            onClick={(e) => {
                                if (m.pending || m.failed) return
                                e.stopPropagation()
                                onViewImage()
                            }}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element -- user photo, already resized */}
                            <img
                                src={image.url}
                                alt="Photo"
                                loading="lazy"
                                draggable={false}
                                className="block w-[240px] max-w-full bg-surface object-cover"
                                style={{ aspectRatio: image.width && image.height ? `${image.width} / ${image.height}` : '4 / 3', maxHeight: 340 }}
                            />
                            {!hasText && <span className="absolute bottom-1.5 right-1.5">{meta(true)}</span>}
                        </span>
                    )}

                    {audio && <VoiceNote audio={audio} mine={mine} meta={meta()} disabled={m.pending || m.failed} />}

                    {hasText && (
                        // flow-root: the bubble grows to contain the floated time
                        <span className={cn('flow-root whitespace-pre-wrap break-words', image && 'px-3 pb-[7px] pt-1 text-[16px] leading-[21px]')}>
                            {renderText(m.content)}
                            {/* Floated so the time sits on the last line when there's room */}
                            {!emojiOnly ? (
                                <span className="float-right ml-2.5 mt-[6px] leading-none">{meta()}</span>
                            ) : (
                                <span className="block text-right">{meta()}</span>
                            )}
                        </span>
                    )}

                    {reactions.length > 0 && (
                        <span
                            className={cn(
                                'absolute -bottom-3.5 flex items-center gap-0.5 rounded-full border-2 border-black bg-surface-2 px-1.5 py-px text-[13px] not-italic',
                                mine ? 'right-2' : 'left-2',
                            )}
                        >
                            {reactions.map(([u, e]) => <span key={u}>{e}</span>)}
                        </span>
                    )}
                </div>
            </div>

            {m.failed && <span className="mt-1 px-1 text-[12px] text-[#ff453a]">Not delivered · tap to retry</span>}
        </div>
    )
}

/** ✓ sent · ✓✓ delivered · blue ✓✓ read · clock while sending */
function Ticks({ m, light }: { m: ChatMessage; light: boolean }) {
    const base = 'h-[14px] w-[14px]'
    if (m.pending) return <Clock className={cn(base, 'h-3 w-3')} aria-label="Sending" />
    if (m.failed) return null
    if (m.readAt) return <CheckCheck className={cn(base, light ? 'text-[#a8e0ff]' : 'text-sky-400')} strokeWidth={2.4} aria-label="Read" />
    if (m.deliveredAt) return <CheckCheck className={base} strokeWidth={2.2} aria-label="Delivered" />
    return <Check className={base} strokeWidth={2.2} aria-label="Sent" />
}

// ------------------------------------------------------------------ swipe to reply

const REPLY_AT = 60

/** WhatsApp-style: drag a message right to reply. Vertical drags scroll as usual. */
function useSwipeToReply(onReply: () => void, enabled: boolean) {
    const [dx, setDx] = useState(0)
    const [dragging, setDragging] = useState(false)
    const g = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; fired: boolean } | null>(null)
    const swiped = useRef(false)

    const end = () => {
        const s = g.current
        g.current = null
        if (s?.axis === 'x') {
            swiped.current = true
            // Browsers often skip the click after a drag; don't let the flag linger
            setTimeout(() => (swiped.current = false), 350)
            if (s.fired) onReply()
        }
        setDragging(false)
        setDx(0)
    }

    const handlers = {
        onTouchStart: (e: React.TouchEvent) => {
            if (!enabled || e.touches.length !== 1) return
            g.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, axis: null, fired: false }
            swiped.current = false
        },
        onTouchMove: (e: React.TouchEvent) => {
            const s = g.current
            if (!s) return
            const ddx = e.touches[0].clientX - s.x
            const ddy = e.touches[0].clientY - s.y
            if (s.axis === null) {
                if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return
                s.axis = ddx > 0 && Math.abs(ddx) > Math.abs(ddy) * 1.2 ? 'x' : 'y'
                if (s.axis === 'x') setDragging(true)
            }
            if (s.axis !== 'x') return
            const d = Math.max(0, ddx)
            // Follows the finger up to the threshold, then resists
            setDx(d < REPLY_AT ? d : REPLY_AT + Math.min(40, (d - REPLY_AT) * 0.25))
            if (d >= REPLY_AT && !s.fired) {
                s.fired = true
                navigator.vibrate?.(10)
            }
        },
        onTouchEnd: end,
        onTouchCancel: end,
    }

    /** A swipe can end with a click event; swallow it so the action sheet doesn't open. */
    const consumeClick = () => {
        if (!swiped.current) return false
        swiped.current = false
        return true
    }

    return { dx, dragging, handlers, consumeClick }
}
