"use client"

import { useState } from 'react'
import Link from 'next/link'
import { Hand, Search, Smile } from 'lucide-react'
import { Avatar } from '@/components/ui/Page'
import { MOOD_OPTIONS } from '@/lib/moods'
import { cn } from '@/lib/utils'

type Props = {
    partner: string
    partnerName: string
    partnerMoodEmoji: string | null
    status: string
    /** typing / recording: shown in the accent colour */
    active: boolean
    myMood: string | null
    onMood: (emoji: string | null, label: string | null) => void
    onNudge: () => void
    onSearch: () => void
}

export function ChatHeader({ partner, partnerName, partnerMoodEmoji, status, active, myMood, onMood, onNudge, onSearch }: Props) {
    const [moodOpen, setMoodOpen] = useState(false)
    return (
        <header className="relative z-20 flex shrink-0 items-center gap-1 border-b border-line bg-black/90 py-2 pl-4 pr-2 backdrop-blur-lg md:px-6">
            {/* Tap name/photo to open their profile */}
            <Link href={`/profile/${partner}`} className="mr-1 flex min-w-0 flex-1 items-center gap-3 active:opacity-70">
                <Avatar name={partnerName} user={partner} showOnline />
                <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-semibold leading-tight">
                        {partnerName}
                        {partnerMoodEmoji && <span className="ml-1.5 font-normal">{partnerMoodEmoji}</span>}
                    </span>
                    {status && <span className={cn('block truncate text-[13px]', active ? 'text-accent' : 'text-muted')}>{status}</span>}
                </span>
            </Link>

            <IconButton label="Search messages" onClick={onSearch}>
                <Search className="h-[21px] w-[21px]" strokeWidth={1.8} />
            </IconButton>

            <div className="relative">
                <IconButton label="Set your mood" onClick={() => setMoodOpen((o) => !o)}>
                    {myMood ? <span className="text-lg">{myMood}</span> : <Smile className="h-[22px] w-[22px]" strokeWidth={1.8} />}
                </IconButton>
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

            <IconButton label="Nudge" onClick={onNudge}>
                <Hand className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </IconButton>
        </header>
    )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
    return (
        <button onClick={onClick} aria-label={label} title={label} className="flex h-10 w-10 items-center justify-center rounded-full text-accent active:bg-surface">
            {children}
        </button>
    )
}
