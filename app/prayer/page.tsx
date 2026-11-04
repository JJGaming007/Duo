"use client"

import { useState } from 'react'
import { Check, Minus, MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Avatar, Group, Page, PageHeader, Row, Section } from '@/components/ui/Page'
import { addSubject, deleteSubject, logPrayer, updateSubject, useMe, usePrayer, useSubjects } from '@/lib/data'
import { prayedText, relativeLabel, todayKey, weekdayInitial } from '@/lib/dates'
import { getUserName } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { PrayerSubject } from '@/lib/types'

export default function PrayerPage() {
    return (
        <Page>
            <PageHeader title="Prayer" subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} />
            <Today />
            <Week />
            <Subjects />
        </Page>
    )
}

const saveError = () => toast.error('Couldn’t save — check your connection')

function Today() {
    const { me, partner, meName, partnerName } = useMe()
    const { data } = usePrayer()
    const mine = data?.today[me] ?? 0
    const theirs = data?.today[partner] ?? 0

    const log = (delta: 1 | -1, together = false) => {
        if (delta > 0) navigator.vibrate?.(10)
        logPrayer(me, delta, together).catch(saveError)
        if (together) toast.success('Added for both of you')
    }

    return (
        <Section title="Today">
            <Group>
                <Row
                    leading={<Avatar name={meName} user={me} size="sm" />}
                    title="You"
                    subtitle={prayedText(mine)}
                    trailing={
                        <span className="flex items-center overflow-hidden rounded-lg bg-surface-2">
                            <button aria-label="Remove one" disabled={mine === 0} onClick={() => log(-1)} className="flex h-8 w-10 items-center justify-center active:bg-line disabled:opacity-30">
                                <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-7 text-center text-[16px] font-semibold tabular-nums">{mine}</span>
                            <button aria-label="Add one" onClick={() => log(1)} className="flex h-8 w-10 items-center justify-center text-accent active:bg-line">
                                <Plus className="h-4 w-4" strokeWidth={2.6} />
                            </button>
                        </span>
                    }
                />
                <Row
                    leading={<Avatar name={partnerName} user={partner} size="sm" />}
                    title={partnerName}
                    subtitle={prayedText(theirs)}
                    trailing={<span className="pr-3 text-[16px] font-semibold tabular-nums text-muted">{theirs}</span>}
                />
                <Row onClick={() => log(1, true)} title={<span className="text-accent">We prayed together</span>} />
            </Group>
        </Section>
    )
}

function Week() {
    const { me, partner, partnerName } = useMe()
    const { data } = usePrayer()
    const today = todayKey()
    const week =
        data?.week ??
        Array.from({ length: 7 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - (6 - i))
            return { date: todayKey(d), 'user-1': 0, 'user-2': 0 }
        })
    const s = data?.streaks

    const streakText = s
        ? [
            s[me] > 0 ? `Your streak: ${s[me]} day${s[me] === 1 ? '' : 's'}` : null,
            s[partner] > 0 ? `${partnerName}: ${s[partner]} day${s[partner] === 1 ? '' : 's'}` : null,
        ].filter(Boolean).join(' · ')
        : ''

    return (
        <Section title="Last 7 days" footer={streakText || undefined}>
            <Group>
                <div className="px-4 py-3">
                    <div className="grid grid-cols-[64px_repeat(7,1fr)] items-center gap-y-2.5 text-center">
                        <span />
                        {week.map((d) => (
                            <span key={d.date} className={cn('text-[12px]', d.date === today ? 'font-semibold text-white' : 'text-muted')}>
                                {weekdayInitial(d.date)}
                            </span>
                        ))}
                        {[me, partner].map((u) => (
                            <WeekRow key={u} label={u === me ? 'You' : getUserName(u)} counts={week.map((d) => d[u])} />
                        ))}
                    </div>
                </div>
            </Group>
        </Section>
    )
}

function WeekRow({ label, counts }: { label: string; counts: number[] }) {
    return (
        <>
            <span className="truncate text-left text-[14px] text-muted">{label}</span>
            {counts.map((c, i) => (
                <span key={i} className="flex justify-center">
                    <span
                        className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums',
                            c > 0 ? 'bg-accent-soft text-accent' : 'text-faint',
                        )}
                    >
                        {c > 0 ? c : '·'}
                    </span>
                </span>
            ))}
        </>
    )
}

function Subjects() {
    const { me, partner, partnerName } = useMe()
    const { data, isLoading } = useSubjects()
    const [tab, setTab] = useState<'active' | 'answered'>('active')
    const [title, setTitle] = useState('')
    const [forWhom, setForWhom] = useState<PrayerSubject['forWhom']>('both')

    const list = data ?? []
    const active = list.filter((s) => !s.answeredAt)
    const answered = list.filter((s) => s.answeredAt)
    const shown = tab === 'active' ? active : answered

    const add = (e: React.FormEvent) => {
        e.preventDefault()
        const t = title.trim()
        if (!t) return
        setTitle('')
        setTab('active')
        addSubject(me, t, forWhom).catch(() => toast.error('Couldn’t add it'))
    }

    return (
        <Section title="Prayer subjects">
            <div className="mb-3 grid grid-cols-2 rounded-lg bg-surface p-0.5 text-[14px]">
                {(['active', 'answered'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn('rounded-md py-1.5 font-medium', tab === t ? 'bg-surface-2 text-white' : 'text-muted')}
                    >
                        {t === 'active' ? `Praying · ${active.length}` : `Answered · ${answered.length}`}
                    </button>
                ))}
            </div>

            <Group>
                {tab === 'active' && (
                    <form onSubmit={add} className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                            <Plus className="h-[18px] w-[18px] shrink-0 text-accent" strokeWidth={2.4} />
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="New prayer subject"
                                maxLength={200}
                                enterKeyHint="done"
                                className="h-8 min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-faint focus:outline-none"
                            />
                            {title.trim() && (
                                <button type="submit" className="text-[15px] font-semibold text-accent">
                                    Add
                                </button>
                            )}
                        </div>
                        {title.trim() && (
                            <div className="ml-[30px] mt-2 flex items-center gap-1.5 text-[13px]">
                                <span className="text-muted">For</span>
                                {([['both', 'Both of us'], [me, 'Me'], [partner, partnerName]] as const).map(([id, label]) => (
                                    <button
                                        type="button"
                                        key={id}
                                        onClick={() => setForWhom(id)}
                                        className={cn('rounded-full px-2.5 py-1', forWhom === id ? 'bg-white text-black' : 'bg-surface-2 text-muted')}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </form>
                )}

                {isLoading && !data ? (
                    <div className="px-4 py-4 text-[15px] text-muted">Loading…</div>
                ) : shown.length === 0 ? (
                    <div className="px-4 py-4 text-[15px] text-muted">
                        {tab === 'active' ? 'Nothing yet.' : 'When a prayer is answered, tick it and it’ll move here.'}
                    </div>
                ) : (
                    shown.map((s) => <SubjectRow key={s.id} subject={s} />)
                )}
            </Group>
        </Section>
    )
}

function SubjectRow({ subject: s }: { subject: PrayerSubject }) {
    const { me } = useMe()
    const [menu, setMenu] = useState(false)
    const answered = !!s.answeredAt
    const pending = s.id.startsWith('tmp-')
    const forLabel = s.forWhom === 'both' ? 'Both' : s.forWhom === me ? 'You' : getUserName(s.forWhom)
    const by = s.createdBy === me ? 'you' : getUserName(s.createdBy)

    const act = (action: 'answer' | 'unanswer' | 'prayed') => {
        if (pending) return
        updateSubject(me, s.id, action).catch(saveError)
        if (action === 'prayed') toast.success('Noted')
    }

    const meta = [
        `For ${forLabel}`,
        answered ? `answered ${relativeLabel(s.answeredAt!)}` : `added by ${by} ${relativeLabel(s.createdAt)}`,
        s.prayedCount > 0 ? `prayed ${s.prayedCount}×` : null,
    ].filter(Boolean).join(' · ')

    return (
        <div className={cn('relative flex items-start gap-3 px-4 py-3', pending && 'opacity-50')}>
            <button
                aria-label={answered ? 'Mark as not answered' : 'Mark as answered'}
                onClick={() => act(answered ? 'unanswer' : 'answer')}
                className={cn(
                    'mt-[1px] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px]',
                    answered ? 'border-accent bg-accent text-white' : 'border-faint',
                )}
            >
                {answered && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
            </button>
            <div className="min-w-0 flex-1">
                <p className={cn('break-words text-[16px] leading-snug', answered && 'text-muted')}>{s.title}</p>
                <p className="mt-0.5 text-[13px] text-muted">{meta}</p>
            </div>
            {!answered && (
                <button onClick={() => act('prayed')} className="mt-[1px] shrink-0 text-[14px] font-medium text-accent active:opacity-60">
                    Prayed
                </button>
            )}
            <button onClick={() => setMenu((m) => !m)} aria-label="More" className="-mr-1 mt-[1px] shrink-0 text-faint">
                <MoreHorizontal className="h-5 w-5" />
            </button>
            {menu && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                    <div className="absolute right-3 top-10 z-20 w-48 overflow-hidden rounded-xl bg-surface-2 shadow-2xl ring-1 ring-line [&>*+*]:border-t [&>*+*]:border-line">
                        {answered && (
                            <button onClick={() => { setMenu(false); act('unanswer') }} className="block w-full px-4 py-3 text-left text-[15px]">
                                Move back to Praying
                            </button>
                        )}
                        <button
                            onClick={() => {
                                setMenu(false)
                                if (!pending && confirm('Delete this prayer subject?')) deleteSubject(me, s.id).catch(saveError)
                            }}
                            className="block w-full px-4 py-3 text-left text-[15px] text-[#ff453a]"
                        >
                            Delete
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
