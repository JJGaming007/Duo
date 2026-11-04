"use client"

import { useEffect, useRef, useState } from 'react'
import { ArrowUp, ChevronLeft, ImagePlus, Loader2, Lock, Mic, Pencil, Smile, Trash2, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { cn } from '@/lib/utils'
import { QUICK_EMOJIS } from '@/lib/moods'
import { prepareImage, type PreparedImage } from '@/lib/images'
import { canRecordVoice, formatClock, MAX_RECORDING_MS, startRecording, type RecordedVoice, type Recorder } from '@/lib/voice'
import type { ChatMessage } from '@/lib/types'

const DRAFT_KEY = 'duo-chat-draft'
const CANCEL_AT = 90 // px slid left
const LOCK_AT = 70 // px slid up

type Props = {
    inputRef: React.RefObject<HTMLTextAreaElement | null>
    replyTo: ChatMessage | null
    editing: ChatMessage | null
    onCancelReply: () => void
    onCancelEdit: () => void
    onTyping: (kind: 'typing' | 'recording') => void
    onSend: (text: string, image?: PreparedImage) => void
    onSendVoice: (voice: RecordedVoice) => void
    onSaveEdit: (text: string) => void
}

export function Composer({ inputRef, replyTo, editing, onCancelReply, onCancelEdit, onTyping, onSend, onSendVoice, onSaveEdit }: Props) {
    const [text, setText] = useState(() => {
        try {
            return localStorage.getItem(DRAFT_KEY) || ''
        } catch {
            return ''
        }
    })
    const [emojiOpen, setEmojiOpen] = useState(false)
    const [photo, setPhoto] = useState<PreparedImage | null>(null)
    const [preparing, setPreparing] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)
    const draftBeforeEdit = useRef('')

    const resize = () => {
        const el = inputRef.current
        if (!el) return
        el.style.height = 'auto'
        el.style.height = `${Math.min(el.scrollHeight, 140)}px`
    }

    // Keep an unsent draft (not while editing another message)
    useEffect(() => {
        if (editing) return
        const t = setTimeout(() => {
            try {
                if (text) localStorage.setItem(DRAFT_KEY, text)
                else localStorage.removeItem(DRAFT_KEY)
            } catch { }
        }, 300)
        return () => clearTimeout(t)
    }, [text, editing])

    // Entering / leaving edit mode (only on transitions — not on first mount,
    // which would wipe the restored draft)
    const prevEditId = useRef<string | null>(null)
    useEffect(() => {
        const id = editing?.id ?? null
        if (id === prevEditId.current) return
        const wasEditing = prevEditId.current !== null
        prevEditId.current = id
        if (editing) {
            if (!wasEditing) draftBeforeEdit.current = text
            setText(editing.content)
            requestAnimationFrame(() => {
                resize()
                const el = inputRef.current
                el?.focus()
                el?.setSelectionRange(el.value.length, el.value.length)
            })
        } else if (wasEditing) {
            setText(draftBeforeEdit.current)
            draftBeforeEdit.current = ''
            requestAnimationFrame(resize)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to edit mode changes
    }, [editing?.id])

    useEffect(() => {
        requestAnimationFrame(resize)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- size the restored draft once
    }, [])

    const attach = async (files: File[]) => {
        if (!files.length) return
        setPreparing(true)
        try {
            if (files.length === 1) {
                setPhoto(await prepareImage(files[0], { max: 1600 }))
                setEmojiOpen(false)
                inputRef.current?.focus()
            } else {
                // Several photos: send each straight away (like picking many in WhatsApp)
                toast.success(`Sending ${files.length} photos`)
                for (const f of files.slice(0, 10)) {
                    try {
                        onSend('', await prepareImage(f, { max: 1600 }))
                    } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Couldn’t use one of the photos')
                    }
                }
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Couldn’t use that photo')
        } finally {
            setPreparing(false)
        }
    }

    const submit = (value = text, withPhoto = true) => {
        const t = value.trim()
        if (editing) {
            if (t && t !== editing.content) onSaveEdit(t)
            else onCancelEdit()
            return
        }
        const img = withPhoto ? photo ?? undefined : undefined
        if (!t && !img) return
        onSend(t, img)
        if (img) setPhoto(null)
        if (withPhoto || value === text) setText('')
        requestAnimationFrame(resize)
        inputRef.current?.focus()
    }

    const hasContent = !!text.trim() || !!photo || !!editing

    // ------------------------------------------------------------- voice recording
    const [rec, setRec] = useState<{ recorder: Recorder; locked: boolean; dx: number; dy: number } | null>(null)
    const [elapsed, setElapsed] = useState(0)
    const pressRef = useRef<{ x: number; y: number; t: number; cancelled: boolean } | null>(null)
    const starting = useRef(false)

    useEffect(() => {
        if (!rec) return
        const t = setInterval(() => {
            const e = Date.now() - rec.recorder.startedAt
            setElapsed(e)
            onTyping('recording')
            if (e >= MAX_RECORDING_MS) finishRecording(true)
        }, 200)
        return () => clearInterval(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps -- interval per recording
    }, [rec?.recorder])

    const finishRecording = async (send: boolean) => {
        const current = rec ?? recRef.current
        if (!current) return
        recRef.current = null
        setRec(null)
        setElapsed(0)
        if (!send) {
            current.recorder.cancel()
            navigator.vibrate?.(15)
            return
        }
        const voice = await current.recorder.stop()
        if (voice) onSendVoice(voice)
        else toast('Hold to record, release to send')
    }
    const recRef = useRef<typeof rec>(null)
    useEffect(() => {
        recRef.current = rec
    }, [rec])

    const onMicDown = async (e: React.PointerEvent<HTMLButtonElement>) => {
        if (starting.current || rec) return
        e.currentTarget.setPointerCapture(e.pointerId)
        pressRef.current = { x: e.clientX, y: e.clientY, t: Date.now(), cancelled: false }
        starting.current = true
        try {
            const recorder = await startRecording()
            starting.current = false
            // Released (or cancelled) while the permission prompt was up
            if (!pressRef.current || pressRef.current.cancelled) {
                recorder.cancel()
                return
            }
            navigator.vibrate?.(12)
            setRec({ recorder, locked: false, dx: 0, dy: 0 })
        } catch {
            starting.current = false
            pressRef.current = null
            toast.error('Microphone access is needed for voice messages')
        }
    }

    const onMicMove = (e: React.PointerEvent) => {
        const p = pressRef.current
        if (!p || !rec || rec.locked) return
        const dx = Math.min(0, e.clientX - p.x)
        const dy = Math.min(0, e.clientY - p.y)
        if (-dx > CANCEL_AT) {
            pressRef.current = null
            finishRecording(false)
            return
        }
        if (-dy > LOCK_AT) {
            navigator.vibrate?.(10)
            setRec({ ...rec, locked: true, dx: 0, dy: 0 })
            return
        }
        setRec({ ...rec, dx, dy })
    }

    const onMicUp = () => {
        const p = pressRef.current
        pressRef.current = null
        if (!rec) {
            // Short tap before recording started
            if (p) p.cancelled = true
            if (p && Date.now() - p.t < 400 && !starting.current) toast('Hold to record, release to send')
            return
        }
        if (!rec.locked) finishRecording(true)
    }

    // ------------------------------------------------------------- render

    return (
        <div className="shrink-0 border-t border-line bg-black/90 px-2 pb-2 pt-2 backdrop-blur-lg md:px-6">
            {(replyTo || editing) && !rec && (
                <div className="mb-2 ml-1 flex items-center gap-2 border-l-[3px] border-accent pl-3 pr-2">
                    {editing && <Pencil className="h-4 w-4 shrink-0 text-accent" />}
                    <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-accent">{editing ? 'Edit message' : `Replying to ${replyTo!.senderName}`}</p>
                        <p className="truncate text-[13px] text-muted">
                            {editing ? editing.content : replyTo!.content || (replyTo!.image ? 'Photo' : replyTo!.audio ? 'Voice message' : '')}
                        </p>
                    </div>
                    {replyTo?.image && !editing && (
                        // eslint-disable-next-line @next/next/no-img-element -- quoted photo thumbnail
                        <img src={replyTo.image.url} alt="" className="h-10 w-10 rounded-md object-cover" />
                    )}
                    <button onClick={editing ? onCancelEdit : onCancelReply} aria-label="Cancel" className="text-muted">
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {(photo || preparing) && !rec && (
                <div className="mb-2 ml-1 flex items-center gap-3">
                    <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-surface">
                        {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element -- local preview
                            <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                            <Loader2 className="absolute inset-0 m-auto h-5 w-5 animate-spin text-faint" />
                        )}
                    </div>
                    <p className="flex-1 text-[13px] text-muted">{photo ? 'Add a caption or send' : 'Preparing…'}</p>
                    {photo && (
                        <button
                            onClick={() => {
                                URL.revokeObjectURL(photo.previewUrl)
                                setPhoto(null)
                            }}
                            aria-label="Remove photo"
                            className="mr-1 text-muted"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    )}
                </div>
            )}

            {emojiOpen && !rec && (
                <div className="mb-2 flex justify-between gap-1 px-1">
                    {QUICK_EMOJIS.map((e) => (
                        <button
                            key={e}
                            onClick={() => {
                                submit(e, false)
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
                className="relative flex items-end gap-1.5"
            >
                {rec ? (
                    <RecordingBar elapsed={elapsed} level={rec.recorder.level} dx={rec.dx} locked={rec.locked} onCancel={() => finishRecording(false)} />
                ) : (
                    <>
                        {!editing && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    onMouseDown={(e) => e.preventDefault()}
                                    aria-label="Send photos"
                                    className="mb-[3px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted active:text-accent"
                                >
                                    <ImagePlus className="h-6 w-6" strokeWidth={1.7} />
                                </button>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        attach(Array.from(e.target.files ?? []))
                                        e.target.value = ''
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setEmojiOpen((o) => !o)}
                                    aria-label="Quick emoji"
                                    className={cn('mb-[3px] flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted', emojiOpen && 'text-accent')}
                                >
                                    <Smile className="h-6 w-6" strokeWidth={1.7} />
                                </button>
                            </>
                        )}
                        <textarea
                            ref={inputRef}
                            value={text}
                            rows={1}
                            onChange={(e) => {
                                setText(e.target.value)
                                resize()
                                if (e.target.value && !editing) onTyping('typing')
                            }}
                            onPaste={(e) => {
                                const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'))
                                if (files.length && !editing) {
                                    e.preventDefault()
                                    attach(files)
                                }
                            }}
                            onKeyDown={(e) => {
                                const coarse = window.matchMedia?.('(pointer: coarse)').matches
                                if (e.key === 'Enter' && !e.shiftKey && !coarse && !e.nativeEvent.isComposing) {
                                    e.preventDefault()
                                    submit()
                                }
                                if (e.key === 'Escape' && editing) onCancelEdit()
                            }}
                            placeholder={editing ? 'Edit message' : photo ? 'Add a caption' : 'Message'}
                            className="max-h-[140px] min-h-[38px] flex-1 resize-none rounded-[19px] border border-line bg-black px-3.5 py-[7px] text-[16px] leading-[22px] text-white placeholder:text-faint focus:outline-none"
                        />
                    </>
                )}

                {hasContent || !canRecordVoice() ? (
                    <button
                        type="submit"
                        aria-label={editing ? 'Save' : 'Send'}
                        disabled={!hasContent}
                        onMouseDown={(e) => e.preventDefault() /* keep keyboard open */}
                        className="mb-[3px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white active:opacity-80 disabled:bg-surface-2 disabled:text-faint"
                    >
                        <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.6} />
                    </button>
                ) : rec?.locked ? (
                    <button
                        type="button"
                        aria-label="Send voice message"
                        onClick={() => finishRecording(true)}
                        className="mb-[3px] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white"
                    >
                        <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.6} />
                    </button>
                ) : (
                    <button
                        type="button"
                        aria-label="Hold to record a voice message"
                        onPointerDown={onMicDown}
                        onPointerMove={onMicMove}
                        onPointerUp={onMicUp}
                        onPointerCancel={() => {
                            pressRef.current = null
                            if (rec && !rec.locked) finishRecording(false)
                        }}
                        onContextMenu={(e) => e.preventDefault()}
                        style={{ transform: rec ? `translate(${rec.dx}px, ${rec.dy}px) scale(1.5)` : undefined, touchAction: 'none' }}
                        className={cn(
                            'mb-[3px] flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full transition-[background-color] [-webkit-touch-callout:none]',
                            rec ? 'bg-accent text-white' : 'text-muted',
                        )}
                    >
                        <Mic className="h-[22px] w-[22px]" strokeWidth={1.8} />
                    </button>
                )}

                {rec && !rec.locked && (
                    <span
                        className="pointer-events-none absolute -top-16 right-0 flex h-14 w-8 flex-col items-center justify-start rounded-full bg-surface-2 pt-2 text-muted"
                        style={{ opacity: Math.min(1, 0.4 + -rec.dy / LOCK_AT) }}
                    >
                        <Lock className="h-4 w-4" />
                        <ChevronLeft className="mt-1 h-4 w-4 rotate-90" />
                    </span>
                )}
            </form>
        </div>
    )
}

function RecordingBar({ elapsed, level, dx, locked, onCancel }: { elapsed: number; level: () => number; dx: number; locked: boolean; onCancel: () => void }) {
    const [lv, setLv] = useState(0)
    useEffect(() => {
        const t = setInterval(() => setLv(level()), 80)
        return () => clearInterval(t)
    }, [level])

    return (
        <div className="flex min-h-[38px] flex-1 items-center gap-3 px-2">
            <span className="relative flex h-3 w-3 shrink-0 items-center justify-center">
                <span className="absolute h-3 w-3 animate-ping rounded-full bg-[#ff453a]/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff453a]" style={{ transform: `scale(${1 + lv * 0.6})` }} />
            </span>
            <span className="w-12 shrink-0 text-[16px] tabular-nums">{formatClock(elapsed)}</span>
            {locked ? (
                <button type="button" onClick={onCancel} className="ml-auto flex items-center gap-1.5 text-[15px] text-[#ff453a]">
                    <Trash2 className="h-4 w-4" /> Cancel
                </button>
            ) : (
                <span
                    className="ml-auto flex items-center gap-1 text-[15px] text-muted"
                    style={{ transform: `translateX(${dx * 0.6}px)`, opacity: Math.max(0.2, 1 + dx / CANCEL_AT) }}
                >
                    <ChevronLeft className="h-4 w-4" /> Slide to cancel
                </span>
            )}
        </div>
    )
}
