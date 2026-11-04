"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
    { href: '/code', label: 'Overview' },
    { href: '/tracker', label: 'Tracker' },
    { href: '/log', label: 'Log' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/playground', label: 'Playground' },
]

// Secondary "Coding" area. Enabled from More → Coding mode.
export default function CodeLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    return (
        <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-line bg-black">
                <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] md:px-6">
                    {TABS.map((t) => (
                        <Link
                            key={t.href}
                            href={t.href}
                            className={cn(
                                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                                pathname === t.href ? 'bg-surface-2 text-white' : 'text-muted hover:text-white',
                            )}
                        >
                            {t.label}
                        </Link>
                    ))}
                </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
    )
}
