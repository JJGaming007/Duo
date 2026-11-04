"use client"

import { useEffect } from 'react'
import { CornerUpLeft, Download, Smile, X } from 'lucide-react'
import { dayLabel, timeLabel } from '@/lib/dates'
import type { ChatMessage } from '@/lib/types'

export function PhotoViewer({ m, mine, onClose, onReply, onMore }: { m: ChatMessage; mine: boolean; onClose: () => void; onReply: () => void; onMore: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black" onClick={onClose}>
            <div className="flex shrink-0 items-center gap-3 px-2 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]" onClick={(e) => e.stopPropagation()}>
                <button onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center text-white">
                    <X className="h-6 w-6" />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{mine ? 'You' : m.senderName}</p>
                    <p className="text-[12px] text-muted">
                        {dayLabel(m.createdAt)} · {timeLabel(m.createdAt)}
                    </p>
                </div>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- full-size user photo */}
                <img src={m.image!.url} alt="Photo" className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
            </div>
            {m.content && <p className="shrink-0 px-5 pt-3 text-center text-[15px] text-white/90">{m.content}</p>}
            <div className="flex shrink-0 justify-around px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 text-[13px] text-white" onClick={(e) => e.stopPropagation()}>
                <button onClick={onReply} className="flex flex-col items-center gap-1">
                    <CornerUpLeft className="h-6 w-6" strokeWidth={1.7} /> Reply
                </button>
                <a href={m.image!.url} download={`duo-photo-${m.id}.jpg`} className="flex flex-col items-center gap-1">
                    <Download className="h-6 w-6" strokeWidth={1.7} /> Save
                </a>
                <button onClick={onMore} className="flex flex-col items-center gap-1">
                    <Smile className="h-6 w-6" strokeWidth={1.7} /> React
                </button>
            </div>
        </div>
    )
}
