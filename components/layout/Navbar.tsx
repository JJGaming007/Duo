"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Grid3X3, PlusCircle, BarChart3, Heart, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIdentity } from '@/lib/identity'
import { getUserName } from '@/lib/constants'

const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Tracker', href: '/tracker', icon: Grid3X3 },
    { name: 'Log', href: '/log', icon: PlusCircle },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Connect', href: '/bond', icon: Heart },
]

export function Navbar() {
    const pathname = usePathname()
    const { currentId, switchUser } = useIdentity()

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-lg md:top-0 md:bottom-auto md:border-t-0 md:border-b shadow-2xl shadow-black">
            <div className="mx-auto max-w-lg md:max-w-7xl md:px-6">
                <div className="flex h-16 items-center justify-between px-6 md:px-0">
                    <div className="hidden items-center gap-2 md:flex">
                        <div className="h-8 w-8 rounded-lg bg-green-600 flex items-center justify-center font-bold text-white shadow-lg shadow-green-900/20">
                            CD
                        </div>
                        <span className="text-lg font-bold tracking-tight text-white">CodeTrack Duo</span>
                    </div>

                    <div className="flex w-full items-center justify-around md:w-auto md:gap-8">
                        {navItems.map((item) => {
                            const Icon = item.icon
                            const isActive = pathname === item.href
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={cn(
                                        "flex flex-col items-center gap-1 transition-all duration-200 md:flex-row md:gap-2",
                                        isActive ? "text-green-500 scale-110 md:scale-100" : "text-zinc-500 hover:text-zinc-300"
                                    )}
                                >
                                    <Icon className={cn("h-6 w-6", isActive && "drop-shadow-[0_0_8px_rgba(34,197,94,0.3)]")} />
                                    <span className="text-[10px] font-medium md:text-sm">{item.name}</span>
                                </Link>
                            )
                        })}
                    </div>

                    <div className="hidden md:flex items-center gap-3">
                        <button
                            onClick={() => switchUser(currentId === 'user-1' ? 'user-2' : 'user-1')}
                            className="flex items-center gap-2 h-9 px-3 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-green-400 hover:border-green-900/50 transition-all text-xs font-bold"
                            title="Switch User"
                        >
                            <RefreshCw className="h-3 w-3" />
                            <span>{getUserName(currentId || 'user-1')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    )
}
