"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookHeart, MessageCircle, Code2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCodingMode } from '@/lib/prefs'
import { unreadCount, useMe, useMessages } from '@/lib/data'
import { useKeyboard } from '@/lib/keyboard'

export const CODE_ROUTES = ['/code', '/tracker', '/log', '/analytics', '/playground']

export function Navbar() {
    const pathname = usePathname()
    const [coding] = useCodingMode()
    const { me } = useMe()
    const { data: messages } = useMessages()
    const unread = unreadCount(messages, me)
    useKeyboard() // starts keyboard tracking app-wide (hides this bar while typing)

    const items = [
        { name: 'Today', href: '/', icon: Home, active: pathname === '/' },
        { name: 'Prayer', href: '/prayer', icon: BookHeart, active: pathname.startsWith('/prayer') },
        { name: 'Chat', href: '/chat', icon: MessageCircle, active: pathname.startsWith('/chat'), badge: unread },
        ...(coding ? [{ name: 'Coding', href: '/code', icon: Code2, active: CODE_ROUTES.some((r) => pathname.startsWith(r)) }] : []),
        { name: 'Settings', href: '/more', icon: Settings, active: pathname.startsWith('/more') || pathname.startsWith('/games') },
    ]

    return (
        <nav data-tabbar className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-black/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:bottom-auto md:top-0 md:border-b md:border-t-0 md:pb-0">
            <div className="mx-auto flex h-16 max-w-xl items-stretch md:h-14 md:max-w-3xl md:items-center md:gap-6 md:px-4">
                <span className="hidden text-[17px] font-semibold md:block">Duo</span>
                {items.map(({ name, href, icon: Icon, active, badge }) => (
                    <Link
                        key={href}
                        href={href}
                        prefetch
                        className={cn(
                            'flex flex-1 flex-col items-center justify-center gap-[3px] pt-1 md:flex-none md:flex-row md:gap-1.5 md:pt-0',
                            active ? 'text-accent' : 'text-muted hover:text-white',
                        )}
                    >
                        <span className="relative">
                            <Icon className="h-6 w-6 md:h-[18px] md:w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                            {!!badge && (
                                <span className="absolute -right-2.5 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#ff3b30] px-[5px] text-[11px] font-semibold leading-none text-white">
                                    {badge > 99 ? '99+' : badge}
                                </span>
                            )}
                        </span>
                        <span className="text-[10.5px] font-medium md:text-[14px]">{name}</span>
                    </Link>
                ))}
            </div>
        </nav>
    )
}
