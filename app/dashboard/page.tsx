"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Flame, Trophy, Calendar, CheckCircle2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { pusherClient } from '@/lib/pusher'
import { useIdentity } from '@/lib/identity'
import { getUserName } from '@/lib/constants'
import useSWR from 'swr'
import { showOsNotification } from '@/lib/notifications'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function DashboardPage() {
    const router = useRouter()
    const { currentId, isLoading } = useIdentity()

    const { data: stats, mutate } = useSWR(currentId ? `/api/stats?userId=${currentId}` : null, fetcher, {
        revalidateOnFocus: true
    })

    useEffect(() => {
        if (currentId) {
            // Real-time listener for partner progress
            const channel = pusherClient.subscribe('partner-progress')
            channel.bind('log-complete', (data: any) => {
                if (data.userId !== currentId) {
                    toast(`${data.userName || 'Partner'} just completed a day! 🚀`, {
                        icon: '👏',
                    })
                    if (document.hidden) {
                        showOsNotification('CodeTrack Duo', { body: `${data.userName || 'Partner'} just completed a day! 🚀` })
                    }
                    mutate()
                }
            })

            return () => {
                pusherClient.unsubscribe('partner-progress')
            }
        }
    }, [currentId])

    if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-4 border-green-600 border-t-transparent"></div></div>

    // Provide default stats while SWR is loading to avoid layout shifts or blocking spinners
    const currentStats = stats || {
        userStreak: 0,
        partnerStreak: 0,
        todayCompleted: false,
        courseDay: 1,
    }

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
                <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                    <span className="px-2 py-0.5 rounded-full bg-green-900/20 border border-green-900/50 text-green-500 text-[10px] uppercase font-bold tracking-wider">
                        Logged in as {getUserName(currentId || 'user-1')}
                    </span>
                </div>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
                <Card className="border-green-900/50 bg-green-950/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Your Streak</CardTitle>
                        <Flame className="h-5 w-5 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-white">{currentStats.userStreak}</div>
                        <p className="text-xs text-zinc-500">Keep it up! 🔥</p>
                    </CardContent>
                </Card>
                <Card className="border-blue-900/50 bg-blue-950/10">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-zinc-400">Partner&apos;s Streak</CardTitle>
                        <Trophy className="h-5 w-5 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-bold text-white">{currentStats.partnerStreak}</div>
                        <p className="text-xs text-zinc-500">Healthy competition! 🚀</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="relative overflow-hidden border-zinc-800 bg-zinc-900/40">
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-1/4 -translate-y-1/4 rounded-full bg-green-500/10 blur-3xl"></div>
                <CardHeader>
                    <div className="flex items-center gap-2 text-zinc-400">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm font-medium uppercase tracking-wider">Day {currentStats.courseDay} of 100</span>
                    </div>
                    <CardTitle className="text-2xl font-bold">Today&apos;s Progress</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-6 gap-6">
                    <div className={cn(
                        "h-24 w-24 rounded-full flex items-center justify-center transition-all duration-500",
                        currentStats.todayCompleted ? "bg-green-600 shadow-lg shadow-green-900/40" : "bg-zinc-800 border-2 border-dashed border-zinc-700"
                    )}>
                        {currentStats.todayCompleted ? (
                            <CheckCircle2 className="h-12 w-12 text-white" />
                        ) : (
                            <span className="text-zinc-600 font-bold text-xl">?</span>
                        )}
                    </div>

                    <div className="text-center">
                        <p className="text-zinc-300 font-medium">
                            {currentStats.todayCompleted ? "You've crushed it today!" : "Haven't logged progress yet."}
                        </p>
                    </div>

                    {!currentStats.todayCompleted && (
                        <Button size="lg" className="w-full max-w-xs transition-transform active:scale-95 shadow-lg shadow-green-900/20" onClick={() => router.push('/log')}>
                            Mark Today Complete
                        </Button>
                    )}
                </CardContent>
            </Card>

            <section className="space-y-4 md:hidden">
                <Button
                    variant="secondary"
                    className="w-full flex justify-between h-12"
                    onClick={() => router.push('/log')}
                >
                    <span>Log Progress as {getUserName(currentId || 'user-1')}</span>
                    <Calendar className="h-4 w-4" />
                </Button>
            </section>

            <Card className="bg-zinc-900/20 border-zinc-800/50 italic text-zinc-400">
                <CardContent className="pt-6">
                    &quot;The only way to learn a new programming language is by writing programs in it.&quot;
                    <span className="block mt-2 font-not-italic text-sm text-zinc-500">— Dennis Ritchie</span>
                </CardContent>
            </Card>
        </div>
    )
}
