"use client"

import { Avatar, Group, Page, PageHeader, Row, Section } from '@/components/ui/Page'
import { NotificationPrompt } from '@/components/NotificationPrompt'
import { useMe } from '@/lib/data'
import { useCodingMode } from '@/lib/prefs'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
    const { me, partner, meName, partnerName, switchUser } = useMe()
    const [coding, setCoding] = useCodingMode()

    return (
        <Page>
            <PageHeader title="Settings" />

            <Section title="Signed in on this device">
                <Group>
                    <Row leading={<Avatar name={meName} user={me} size="lg" />} title={<span className="text-[18px] font-semibold">{meName}</span>} subtitle={`Partner: ${partnerName}`} />
                    <Row
                        onClick={() => {
                            if (confirm(`Switch this device to ${partnerName}?`)) switchUser(partner)
                        }}
                        title={<span className="text-accent">Switch to {partnerName}</span>}
                    />
                </Group>
            </Section>

            <Section>
                <NotificationPrompt />
            </Section>

            <Section title="Extras" footer="Coding mode adds the 100 Days of Code tracker, daily log, analytics and Python playground as a tab.">
                <Group>
                    <Row title="Coding mode" trailing={<Switch checked={coding} onChange={setCoding} label="Coding mode" />} />
                    {coding && <Row href="/code" title="Open Coding" chevron />}
                    <Row href="/games" title="Tic-tac-toe" chevron />
                </Group>
            </Section>

            <p className="mt-8 text-center text-[13px] text-faint">Duo {process.env.NEXT_PUBLIC_BUILD_ID || 'dev'}</p>
        </Page>
    )
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={cn('relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors', checked ? 'bg-[#34c759]' : 'bg-[#39393d]')}
        >
            <span className={cn('absolute left-0 top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-[2px]')} />
        </button>
    )
}
