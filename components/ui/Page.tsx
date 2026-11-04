import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

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

export function Avatar({ name, user, size = 'md' }: { name: string; user: string; size?: 'sm' | 'md' | 'lg' }) {
    const sizes = { sm: 'h-7 w-7 text-[12px]', md: 'h-9 w-9 text-[14px]', lg: 'h-12 w-12 text-[18px]' }
    return (
        <span
            className={cn(
                'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
                user === 'user-1' ? 'bg-me' : 'bg-partner',
                sizes[size],
            )}
        >
            {name.charAt(0).toUpperCase()}
        </span>
    )
}

export function Spinner({ className }: { className?: string }) {
    return <div className={cn('h-5 w-5 animate-spin rounded-full border-2 border-line border-t-muted', className)} />
}
