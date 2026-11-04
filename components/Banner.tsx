"use client"

import { toast, type Toast } from 'react-hot-toast'
import { Avatar } from '@/components/ui/Page'
import { getUserName } from '@/lib/constants'
import { cn } from '@/lib/utils'

/**
 * In-app banner for activity from your partner while the app is open
 * (the OS notification is skipped then). Looks like a system banner: photo,
 * name, one line. Tap to open; swipe up / wait to dismiss.
 */
export function showBanner(opts: { from: string; text: string; onOpen: () => void; id?: string }) {
    toast.custom((t) => <Banner t={t} {...opts} />, { id: opts.id ?? `banner-${opts.from}`, duration: 4000 })
}

function Banner({ t, from, text, onOpen }: { t: Toast; from: string; text: string; onOpen: () => void }) {
    return (
        <button
            onClick={() => {
                toast.dismiss(t.id)
                onOpen()
            }}
            className={cn(
                'pointer-events-auto flex w-full max-w-[400px] items-center gap-3 rounded-[18px] bg-[rgba(38,38,41,0.96)] px-3 py-2.5 text-left shadow-[0_8px_30px_rgba(0,0,0,.5)] backdrop-blur-xl transition-all duration-300',
                t.visible ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0',
            )}
        >
            <Avatar name={getUserName(from)} user={from} />
            <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold leading-tight text-white">{getUserName(from)}</span>
                <span className="block truncate text-[14px] leading-snug text-white/70">{text}</span>
            </span>
        </button>
    )
}
