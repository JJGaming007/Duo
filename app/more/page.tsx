"use client"

import { useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { Avatar, Group, Page, PageHeader, Row, Section } from '@/components/ui/Page'
import { NotificationPrompt } from '@/components/NotificationPrompt'
import { setProfilePhoto, useDuo, useMe } from '@/lib/data'
import { prepareImage } from '@/lib/images'
import { useCodingMode } from '@/lib/prefs'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
    const { me, partner, meName, partnerName, switchUser } = useMe()
    const [coding, setCoding] = useCodingMode()
    const { data: members } = useDuo()
    const hasPhoto = !!members?.find((m) => m.id === me)?.image
    const fileRef = useRef<HTMLInputElement>(null)
    const [saving, setSaving] = useState(false)

    const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        setSaving(true)
        try {
            const img = await prepareImage(file, { max: 256, square: true, quality: 0.85 })
            await setProfilePhoto(me, img)
            URL.revokeObjectURL(img.previewUrl)
            toast.success('Profile photo updated')
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Couldn’t update photo')
        } finally {
            setSaving(false)
        }
    }

    const removePhoto = async () => {
        setSaving(true)
        try {
            await setProfilePhoto(me, null)
        } catch {
            toast.error('Couldn’t remove photo')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Page>
            <PageHeader title="Settings" />

            <Section>
                <Group>
                    <div className="flex flex-col items-center px-4 pb-4 pt-5">
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={saving}
                            aria-label="Change profile photo"
                            className={cn('rounded-full', saving && 'opacity-50')}
                        >
                            <Avatar name={meName} user={me} size="xl" />
                        </button>
                        <p className="mt-3 text-[20px] font-semibold">{meName}</p>
                        <button onClick={() => fileRef.current?.click()} disabled={saving} className="mt-1 text-[15px] text-accent disabled:opacity-50">
                            {saving ? 'Saving…' : hasPhoto ? 'Change photo' : 'Add photo'}
                        </button>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
                    </div>
                    {hasPhoto && <Row onClick={removePhoto} title={<span className="text-[#ff453a]">Remove photo</span>} />}
                </Group>
            </Section>

            <Section title="This device">
                <Group>
                    <Row title="Signed in as" trailing={<span className="text-[16px] text-muted">{meName}</span>} />
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
