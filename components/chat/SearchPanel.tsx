"use client"

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, Loader2, Search, X } from 'lucide-react'
import { searchMessages } from '@/lib/data'
import { dayLabel, timeLabel } from '@/lib/dates'
import type { ChatMessage } from '@/lib/types'
import { mark } from './format'

export function SearchPanel({ me, onClose, onPick }: { me: string; onClose: () => void; onPick: (m: ChatMessage) => void }) {
    const [q, setQ] = useState('')
    const [results, setResults] = useState<ChatMessage[] | null>(null)
    const [loading, setLoading] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    useEffect(() => {
        const term = q.trim()
        if (term.length < 2) return
        let cancelled = false
        const t = setTimeout(() => {
            setLoading(true)
            searchMessages(term)
                .then((r) => !cancelled && setResults(r))
                .catch(() => !cancelled && setResults([]))
                .finally(() => !cancelled && setLoading(false))
        }, 250)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [q])

    return (
        <div className="absolute inset-0 z-30 flex flex-col bg-black">
            <div className="flex shrink-0 items-center gap-2 border-b border-line px-2 py-2">
                <button onClick={onClose} aria-label="Close search" className="flex h-10 w-10 items-center justify-center text-accent">
                    <ChevronLeft className="h-6 w-6" />
                </button>
                <div className="flex h-9 flex-1 items-center gap-2 rounded-[10px] bg-surface-2 px-3">
                    <Search className="h-4 w-4 shrink-0 text-muted" />
                    <input
                        ref={inputRef}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search messages"
                        enterKeyHint="search"
                        className="h-full min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-faint focus:outline-none"
                    />
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted" />
                    ) : (
                        q && (
                            <button onClick={() => setQ('')} aria-label="Clear" className="text-muted">
                                <X className="h-4 w-4" />
                            </button>
                        )
                    )}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {q.trim().length < 2 || results === null ? (
                    <p className="px-6 py-10 text-center text-[15px] text-muted">Search your conversation</p>
                ) : results.length === 0 ? (
                    <p className="px-6 py-10 text-center text-[15px] text-muted">No messages found</p>
                ) : (
                    <ul className="[&>*+*]:border-t [&>*+*]:border-line">
                        {results.map((m) => (
                            <li key={m.id}>
                                <button onClick={() => onPick(m)} className="block w-full px-4 py-3 text-left active:bg-surface">
                                    <span className="flex items-baseline justify-between gap-3">
                                        <span className="text-[14px] font-semibold">{m.senderId === me ? 'You' : m.senderName}</span>
                                        <span className="shrink-0 text-[12px] text-muted">
                                            {dayLabel(m.createdAt)}, {timeLabel(m.createdAt)}
                                        </span>
                                    </span>
                                    <span className="mt-0.5 line-clamp-2 text-[15px] text-white/80">{mark(m.content, q.trim())}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    )
}
