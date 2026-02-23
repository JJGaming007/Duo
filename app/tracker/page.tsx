"use client"

import { cn } from '@/lib/utils'
import { Check, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useIdentity } from '@/lib/identity'

export default function TrackerPage() {
    const { currentId, isLoading: idLoading } = useIdentity()
    const [completedDays, setCompletedDays] = useState<number[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchProgress = async () => {
            if (!currentId) return
            try {
                const res = await fetch(`/api/progress?userId=${currentId}`)
                if (res.ok) {
                    const data = await res.json()
                    setCompletedDays(data.map((d: any) => d.courseDay))
                }
            } catch (error) {
                console.error(error)
            } finally {
                setLoading(false)
            }
        }

        fetchProgress()
    }, [currentId])

    const days = Array.from({ length: 100 }, (_, i) => i + 1)

    if (idLoading || loading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-4 border-green-600 border-t-transparent"></div></div>

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <header className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight text-white">Course Tracker</h1>
                <div className="flex items-center gap-4">
                    <div className="h-2 flex-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-1000"
                            style={{ width: `${completedDays.length}%` }}
                        ></div>
                    </div>
                    <span className="text-sm font-bold text-green-500">{completedDays.length}/100</span>
                </div>
            </header>

            <div className="grid grid-cols-4 gap-3 sm:grid-cols-5 md:grid-cols-10">
                {days.map((day) => {
                    const isCompleted = completedDays.includes(day)
                    const isNext = day === (Math.max(0, ...completedDays) + 1)

                    return (
                        <div
                            key={day}
                            className={cn(
                                "group relative aspect-square cursor-pointer rounded-xl border transition-all duration-300 hover:scale-105 active:scale-95",
                                isCompleted
                                    ? "border-green-600 bg-green-600/20 text-green-500 shadow-lg shadow-green-900/20"
                                    : isNext
                                        ? "border-green-500/50 bg-green-500/5 text-green-400 animate-pulse"
                                        : "border-zinc-800 bg-zinc-900/40 text-zinc-600 hover:border-zinc-700 hover:text-zinc-400"
                            )}
                        >
                            <div className="flex h-full flex-col items-center justify-center gap-1">
                                <span className="text-xs font-bold">{day}</span>
                                {isCompleted && <Check className="h-3 w-3 animate-in zoom-in" />}
                                {!isCompleted && !isNext && day > Math.max(0, ...completedDays) + 5 && (
                                    <Lock className="h-2 w-2 opacity-20" />
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
