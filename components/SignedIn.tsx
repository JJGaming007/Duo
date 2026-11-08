"use client"

import { usePathname } from 'next/navigation'
import { useIdentity } from '@/lib/identity'

/** Renders app chrome (tab bar, realtime) only for a signed-in device, never on /login. */
export function SignedIn({ children }: { children: React.ReactNode }) {
    const { currentId } = useIdentity()
    const pathname = usePathname()
    if (!currentId || pathname === '/login') return null
    return <>{children}</>
}
