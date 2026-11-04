"use client"

import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDuo } from '@/lib/data'
import { useIsOnline } from '@/lib/presence'

// Building blocks modelled on native grouped lists (iOS Settings / Reminders).

export function Page({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={cn('mx-auto w-full max-w-xl px-4 pb-10 pt-4 md:pt-8', className)}>{children}</div>
}

export function PageHeader({ title, subtitle, right }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode }) {
    return (
        <header className="mb-5 flex items-end justify-between gap-3 px-1 pt-2">
            <div className="min-w-0">
                <h1 className="truncate text-[30px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
                {subtitle && <p className="mt-0.5 text-[15px] text-muted">{subtitle}</p>}
            </div>
            {right && <div className="shrink-0 pb-1">{right}</div>}
        </header>
    )
}

export function Section({
    title,
    action,
    footer,
    className,
    children,
}: {
    title?: React.ReactNode
    action?: React.ReactNode
    footer?: React.ReactNode
    className?: string
    children: React.ReactNode
}) {
    return (
        <section className={cn('mb-7', className)}>
            {(title || action) && (
                <div className="mb-1.5 flex items-baseline justify-between px-4">
                    {title && <h2 className="text-[13px] text-muted">{title}</h2>}
                    {action}
                </div>
            )}
            {children}
            {footer && <p className="mt-1.5 px-4 text-[13px] leading-snug text-muted">{footer}</p>}
        </section>
    )
}

/** A rounded group of rows with hairline separators */
export function Group({ className, children }: { className?: string; children: React.ReactNode }) {
    return <div className={cn('overflow-hidden rounded-xl bg-surface [&>*+*]:border-t [&>*+*]:border-line', className)}>{children}</div>
}

export function Row({
    href,
    onClick,
    leading,
    title,
    subtitle,
    trailing,
    chevron,
    className,
}: {
    href?: string
    onClick?: () => void
    leading?: React.ReactNode
    title: React.ReactNode
    subtitle?: React.ReactNode
    trailing?: React.ReactNode
    chevron?: boolean
    className?: string
}) {
    const inner = (
        <>
            {leading}
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] leading-snug">{title}</span>
                {subtitle && <span className="mt-0.5 block truncate text-[13px] text-muted">{subtitle}</span>}
            </span>
            {trailing}
            {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-faint" />}
        </>
    )
    const cls = cn('flex min-h-[48px] w-full items-center gap-3 px-4 py-2.5 text-left', (href || onClick) && 'active:bg-surface-2', className)
    if (href) return <Link href={href} className={cls}>{inner}</Link>
    if (onClick) return <button type="button" onClick={onClick} className={cls}>{inner}</button>
    return <div className={cls}>{inner}</div>
}

export function Avatar({
    name,
    user,
    size = 'md',
    showOnline = false,
}: {
    name: string
    user: string
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
    /** Green dot while this person has the app open */
    showOnline?: boolean
}) {
    const { data: members } = useDuo()
    const online = useIsOnline(user)
    const src = members?.find((m) => m.id === user)?.image
    const sizes = { sm: 'h-7 w-7 text-[12px]', md: 'h-9 w-9 text-[14px]', lg: 'h-12 w-12 text-[18px]', xl: 'h-20 w-20 text-[30px]', '2xl': 'h-28 w-28 text-[44px]' }
    return (
        <span className={cn('relative inline-flex shrink-0', sizes[size])}>
            <span
                className={cn(
                    'relative flex h-full w-full items-center justify-center overflow-hidden rounded-full font-semibold text-white',
                    user === 'user-1' ? 'bg-me' : 'bg-partner',
                )}
            >
                {name.charAt(0).toUpperCase()}
                {src && (
                    // eslint-disable-next-line @next/next/no-img-element -- small, already-resized avatar
                    <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                )}
            </span>
            {showOnline && online && (
                <span
                    aria-label="Online"
                    className={cn(
                        'absolute bottom-0 right-0 rounded-full bg-[#34c759] ring-2 ring-black',
                        size === 'xl' || size === '2xl' ? 'h-5 w-5 ring-[3px]' : size === 'lg' ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5',
                    )}
                />
            )}
        </span>
    )
}

export function Spinner({ className }: { className?: string }) {
    return <div className={cn('h-5 w-5 animate-spin rounded-full border-2 border-line border-t-muted', className)} />
}
