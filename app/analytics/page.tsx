"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { useEffect, useState } from 'react'
import { BarChart3, Clock, Target, Zap, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIdentity } from '@/lib/identity'
import { getUserName } from '@/lib/constants'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function AnalyticsPage() {
    const { currentId, isLoading: idLoading } = useIdentity()

    const { data: stats } = useSWR(currentId ? `/api/analytics?userId=${currentId}` : null, fetcher)

    if (idLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-4 border-green-600 border-t-transparent"></div></div>

    const currentStats = stats || {
        totalDays: 0,
        totalMinutes: 0,
        completionRate: 0,
        currentStreak: 0,
        longestStreak: 0,
        userCount: 0,
        partnerCount: 0,
        recentProgress: [] as { day: number, time: number }[]
    }

    const hours = Math.floor(currentStats.totalMinutes / 60)
    const remainingMinutes = currentStats.totalMinutes % 60

    const diff = currentStats.userCount - currentStats.partnerCount;

    return (
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">Analytics</h1>
                <p className="text-zinc-400">Track your overall growth and consistency.</p>
            </header>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-zinc-900/40 border-zinc-800 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-zinc-400">Total Study Time</CardTitle>
                        <Clock className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{hours}h {remainingMinutes}m</div>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900/40 border-zinc-800 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-zinc-400">Completion Rate</CardTitle>
                        <Target className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{currentStats.completionRate}%</div>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900/40 border-zinc-800 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-zinc-400">Current Streak</CardTitle>
                        <Zap className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{currentStats.currentStreak} Days</div>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900/40 border-zinc-800 shadow-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium text-zinc-400">Longest Streak</CardTitle>
                        <BarChart3 className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{currentStats.longestStreak} Days</div>
                    </CardContent>
                </Card>
            </div>

            <section className="space-y-4">
                <h2 className="text-xl font-bold text-white">Consistency Chart</h2>
                <Card className="bg-zinc-900/20 border-zinc-800">
                    <CardContent className="h-64 flex items-end justify-between p-6 gap-2">
                        {(currentStats.recentProgress.length > 0 ? currentStats.recentProgress : Array(7).fill({ day: 0, time: 20 })).map((item: any, i: number) => (
                            <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                                <div
                                    className="w-full bg-green-600/20 rounded-t-lg transition-all group-hover:bg-green-600/50 relative overflow-hidden"
                                    style={{ height: `${Math.min(100, (item.time / 120) * 100)}%`, minHeight: '4px' }}
                                >
                                    <div className="absolute inset-x-0 top-0 h-1 bg-green-500 opacity-50"></div>
                                </div>
                                <span className="text-[10px] text-zinc-600 font-medium">Day {item.day || i + 1}</span>
                            </div>
                        ))}
                    </CardContent>
                    <div className="px-6 pb-6 pt-0 text-center">
                        <p className="text-xs text-zinc-500 italic">Showing relative activity (minutes) for recent entries</p>
                    </div>
                </Card>
            </section>

            <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800 overflow-hidden relative shadow-2xl">
                <div className="absolute top-0 right-0 p-4 opacity-5">
                    <Trophy className="h-32 w-32" />
                </div>
                <CardHeader>
                    <CardTitle>Partner Comparison</CardTitle>
                    <CardDescription>See how you stack up against your partner ({getUserName(currentId || 'user-1')} vs {getUserName(currentId === 'user-1' ? 'user-2' : 'user-1')}).</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-400 font-medium tracking-wide uppercase">Total Days Completed</span>
                            <span className={cn(
                                "text-sm font-bold",
                                diff > 0 ? "text-green-500" : diff < 0 ? "text-blue-500" : "text-zinc-500"
                            )}>
                                {diff > 0 ? `You lead by ${diff} days!` : diff < 0 ? `You're trailing by ${Math.abs(diff)} days.` : "You're neck and neck!"}
                            </span>
                        </div>
                        <div className="relative h-6 w-full bg-zinc-800 rounded-full overflow-hidden flex shadow-inner border border-zinc-700/50">
                            <div
                                className="h-full bg-gradient-to-r from-green-600 to-green-500 transition-all duration-1000"
                                style={{ width: `${(currentStats.userCount / (currentStats.userCount + currentStats.partnerCount || 1)) * 100}%` }}
                            ></div>
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-1000 opacity-60"
                                style={{ width: `${(currentStats.partnerCount / (currentStats.userCount + currentStats.partnerCount || 1)) * 100}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-[11px] uppercase font-bold tracking-tight text-zinc-500">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                <span>You ({currentStats.userCount})</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                <span>Partner ({currentStats.partnerCount})</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
