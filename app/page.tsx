"use client"

import { Plus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import useSWR from 'swr'
import { Avatar, Group, Page, PageHeader, Row, Section } from '@/components/ui/Page'
import { NotificationPrompt } from '@/components/NotificationPrompt'
import { logPrayer, unreadCount, useDuo, useMe, useMessages, usePrayer, useSubjects } from '@/lib/data'
import { prayedText, relativeLabel } from '@/lib/dates'
import { useCodingMode } from '@/lib/prefs'
import { cn } from '@/lib/utils'

export default function TodayPage() {
    const { me, partner, meName, partnerName } = useMe()
    const { data: prayer } = usePrayer()
    const { data: subjects } = useSubjects()
    const { data: messages } = useMessages()
    const { data: members } = useDuo()
    const [coding] = useCodingMode()

    const mine = prayer?.today[me] ?? 0
    const theirs = prayer?.today[partner] ?? 0
    const active = (subjects ?? []).filter((s) => !s.answeredAt)
    const last = messages?.[0]
    const unread = unreadCount(messages, me)
    const partnerMood = members?.find((u) => u.id === partner)
    const streak = prayer?.streaks

    const pray = () => {
        navigator.vibrate?.(10)
        logPrayer(me, 1).catch(() => toast.error('Couldn’t save — check your connection'))
    }

    return (
        <Page>
            <PageHeader
                title="Today"
                subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            />

            <NotificationPrompt compact />

            <Section title="Messages">
                <Group>
                    <Row
                        href="/chat"
                        leading={<Avatar name={partnerName} user={partner} showOnline />}
                        title={
                            <span className="flex items-baseline justify-between gap-2">
                                <span className="font-semibold">
                                    {partnerName}
                                    {partnerMood?.moodEmoji && <span className="ml-1.5 font-normal">{partnerMood.moodEmoji}</span>}
                                </span>
                                {last && <span className="shrink-0 text-[13px] text-muted">{relativeLabel(last.createdAt)}</span>}
                            </span>
                        }
                        subtitle={
                            <span className={cn(unread > 0 && 'text-white')}>
                                {last ? `${last.senderId === me ? 'You: ' : ''}${last.content || (last.image ? 'Photo' : '')}` : 'No messages yet'}
                            </span>
                        }
                        trailing={
                            unread > 0 ? (
                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[12px] font-semibold text-white">
                                    {unread}
                                </span>
                            ) : undefined
                        }
                    />
                </Group>
            </Section>

            <Section
                title="Prayer"
                footer={
                    streak && (streak[me] > 1 || streak[partner] > 1)
                        ? [streak[me] > 1 && `You’ve prayed ${streak[me]} days in a row.`, streak[partner] > 1 && `${partnerName}: ${streak[partner]} days.`]
                            .filter(Boolean)
                            .join(' ')
                        : undefined
                }
            >
                <Group>
                    <Row
                        leading={<Avatar name={meName} user={me} size="sm" />}
                        title="You"
                        subtitle={prayedText(mine)}
                        trailing={
                            <button
                                onClick={pray}
                                className="flex h-8 items-center gap-1 rounded-full bg-accent px-3 text-[14px] font-semibold text-white active:opacity-80"
                            >
                                <Plus className="h-4 w-4" strokeWidth={2.6} /> Prayed
                            </button>
                        }
                    />
                    <Row href="/prayer" leading={<Avatar name={partnerName} user={partner} size="sm" />} title={partnerName} subtitle={prayedText(theirs)} chevron />
                </Group>
            </Section>

            <Section title="Praying for">
                <Group>
                    {active.length === 0 ? (
                        <Row href="/prayer" title={<span className="text-muted">Add a prayer subject</span>} chevron />
                    ) : (
                        <>
                            {active.slice(0, 4).map((s) => (
                                <Row
                                    key={s.id}
                                    href="/prayer"
                                    leading={<span className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-faint" />}
                                    title={s.title}
                                />
                            ))}
                            {active.length > 4 && <Row href="/prayer" title={<span className="text-accent">Show all {active.length}</span>} />}
                        </>
                    )}
                </Group>
            </Section>

            {coding && <CodingRow />}
        </Page>
    )
}

function CodingRow() {
    const { me } = useMe()
    const { data } = useSWR<{ userStreak: number; todayCompleted: boolean; courseDay: number }>(`/api/stats?userId=${me}`)
    return (
        <Section title="Coding">
            <Group>
                <Row
                    href="/code"
                    title={`Day ${data?.courseDay ?? '–'} of 100`}
                    subtitle={`${data?.todayCompleted ? 'Logged today' : 'Not logged today'} · ${data?.userStreak ?? 0}-day streak`}
                    chevron
                />
            </Group>
        </Section>
    )
}
