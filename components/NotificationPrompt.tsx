"use client"

import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { enableNotifications, getNotificationState, type NotifState } from '@/lib/notifications'
import { useMe } from '@/lib/data'
import { Group, Row, Section } from '@/components/ui/Page'

/**
 * Notification status / call-to-action for this device.
 * `compact` (Today screen) only shows when there's something to do.
 */
export function NotificationPrompt({ compact = false }: { compact?: boolean }) {
    const { me } = useMe()
    // The app shell renders client-only (see SWRProvider), so this is safe to read directly
    const [state, setState] = useState<NotifState>(getNotificationState)
    const [busy, setBusy] = useState(false)

    if (compact && state !== 'default' && state !== 'needs-install') return null

    const enable = async () => {
        setBusy(true)
        const next = await enableNotifications(me)
        setState(next)
        setBusy(false)
        if (next === 'granted') toast.success('Notifications turned on')
        else if (next === 'denied') toast.error('Notifications are blocked in settings')
    }

    const content = {
        'needs-install': {
            title: 'Add Duo to your Home Screen',
            subtitle: 'On iPhone, tap Share → Add to Home Screen, then open Duo from there to get notifications.',
            trailing: null,
        },
        default: {
            title: 'Notifications',
            subtitle: 'Get told about new messages and prayers.',
            trailing: (
                <button onClick={enable} disabled={busy} className="shrink-0 text-[15px] font-semibold text-accent disabled:opacity-50">
                    {busy ? 'Turning on…' : 'Turn on'}
                </button>
            ),
        },
        granted: {
            title: 'Notifications are on',
            subtitle: 'For this device',
            trailing: (
                <button onClick={enable} disabled={busy} className="shrink-0 text-[15px] text-accent disabled:opacity-50">
                    Re-sync
                </button>
            ),
        },
        denied: {
            title: 'Notifications are blocked',
            subtitle: 'Allow them for this site in your phone or browser settings.',
            trailing: null,
        },
        unsupported: {
            title: 'Notifications aren’t supported',
            subtitle: 'This browser can’t receive push notifications.',
            trailing: null,
        },
    }[state]

    const body = (
        <Group>
            <Row
                title={content.title}
                subtitle={<span className="whitespace-normal">{content.subtitle}</span>}
                trailing={content.trailing}
                className="items-start py-3"
            />
        </Group>
    )

    return compact ? <Section>{body}</Section> : body
}
