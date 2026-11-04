"use client"

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Avatar, Group, Page, Row, Section } from '@/components/ui/Page'
import { sendNudge, useDuo, useMe, usePrayer, useSubjects } from '@/lib/data'
import { getUserName, type DuoUser } from '@/lib/constants'
import { prayedText, relativeLabel } from '@/lib/dates'
import { lastSeenLabel, useIsOnline } from '@/lib/presence'

export default function ProfileView({ id }: { id: DuoUser }) {
    const router = useRouter()
    const { me } = useMe()
    const { data: members } = useDuo()
    const { data: prayer } = usePrayer()
    const { data: subjects } = useSubjects()
    const online = useIsOnline(id)
    const [viewing, setViewing] = useState(false)

    const isMe = id === me
    const name = getUserName(id)
    const member = members?.find((m) => m.id === id)
    const forThem = (subjects ?? []).filter((s) => !s.answeredAt && (s.forWhom === id || s.forWhom === 'both'))
    const status = isMe ? 'This is you' : online ? 'online' : lastSeenLabel(member?.lastSeenAt) || ' '

    const back = () => (window.history.length > 1 ? router.back() : router.push('/'))

    return (
        <Page>
            <button onClick={back} className="-ml-1.5 mb-2 flex items-center text-[17px] text-accent">
                <ChevronLeft className="h-6 w-6" /> Back
            </button>

            <div className="mb-7 flex flex-col items-center text-center">
                <button
                    onClick={() => member?.image && setViewing(true)}
                    aria-label={member?.image ? 'View photo' : undefined}
                    className="rounded-full"
                >
                    <Avatar name={name} user={id} size="2xl" showOnline={!isMe} />
                </button>
                <h1 className="mt-4 text-[26px] font-bold leading-tight">{name}</h1>
                <p className={online && !isMe ? 'mt-0.5 text-[15px] text-[#34c759]' : 'mt-0.5 text-[15px] text-muted'}>{status}</p>
                {isMe && (
                    <Link href="/more" className="mt-2 text-[15px] text-accent">
                        Edit profile
                    </Link>
                )}
            </div>

            {!isMe && (
                <div className="mb-7 grid grid-cols-2 gap-3">
                    <Link href="/chat" className="rounded-xl bg-surface py-3 text-center text-[15px] font-semibold text-accent active:bg-surface-2">
                        Message
                    </Link>
                    <button
                        onClick={() => {
                            navigator.vibrate?.(15)
                            toast.success(`Sent ${name} a nudge`)
                            sendNudge(me).catch(() => toast.error('Nudge failed'))
                        }}
                        className="rounded-xl bg-surface py-3 text-[15px] font-semibold text-accent active:bg-surface-2"
                    >
                        Nudge
                    </button>
                </div>
            )}

            <Section>
                <Group>
                    <Row
                        title="Mood"
                        trailing={
                            <span className="text-[16px] text-muted">
                                {member?.moodEmoji ? `${member.moodEmoji} ${member.moodLabel ?? ''}` : 'Not set'}
                            </span>
                        }
                    />
                    {member?.moodEmoji && member.moodUpdatedAt && (
                        <Row title="Mood set" trailing={<span className="text-[16px] text-muted">{relativeLabel(member.moodUpdatedAt)}</span>} />
                    )}
                </Group>
            </Section>

            <Section title="Prayer">
                <Group>
                    <Row title="Today" trailing={<span className="text-[16px] text-muted">{prayedText(prayer?.today[id] ?? 0)}</span>} />
                    <Row
                        title="Streak"
                        trailing={
                            <span className="text-[16px] text-muted">
                                {prayer ? `${prayer.streaks[id]} day${prayer.streaks[id] === 1 ? '' : 's'}` : '–'}
                            </span>
                        }
                    />
                </Group>
            </Section>

            <Section title={isMe ? 'Being prayed for you' : `Praying for ${name}`}>
                <Group>
                    {forThem.length === 0 ? (
                        <Row title={<span className="text-muted">Nothing yet</span>} href="/prayer" chevron />
                    ) : (
                        forThem.slice(0, 5).map((s) => (
                            <Row
                                key={s.id}
                                href="/prayer"
                                leading={<span className="h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] border-faint" />}
                                title={s.title}
                                subtitle={s.forWhom === 'both' ? 'For both of you' : undefined}
                            />
                        ))
                    )}
                </Group>
            </Section>

            {viewing && member?.image && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black" onClick={() => setViewing(false)}>
                    <button
                        aria-label="Close"
                        className="absolute left-2 top-[max(0.5rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center text-white"
                    >
                        <X className="h-6 w-6" />
                    </button>
                    {/* eslint-disable-next-line @next/next/no-img-element -- profile photo */}
                    <img src={member.image} alt={name} className="max-h-full max-w-full object-contain" />
                </div>
            )}
        </Page>
    )
}
