"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Toggle } from '@/components/ui/Toggle'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Send, User } from 'lucide-react'
import { useIdentity } from '@/lib/identity'

export default function LogPage() {
    const router = useRouter()
    const { currentId, isLoading } = useIdentity()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        courseDay: 1,
        watched: false,
        practiced: false,
        projectDone: false,
        timeSpentMinutes: 60,
        notes: '',
    })

    useEffect(() => {
        const fetchStats = async () => {
            if (!currentId) return
            try {
                const res = await fetch(`/api/stats?userId=${currentId}`)
                if (res.ok) {
                    const data = await res.json()
                    setFormData(prev => ({ ...prev, courseDay: data.courseDay }))
                }
            } catch (error) {
                console.error(error)
            }
        }
        fetchStats()
    }, [currentId])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!currentId) return
        setLoading(true)

        try {
            const res = await fetch('/api/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, userId: currentId }),
            })

            if (!res.ok) throw new Error('Failed to save progress')

            toast.success('Progress logged! 🔥')
            router.push('/dashboard')
        } catch (error: any) {
            toast.error(error.message)
        } finally {
            setLoading(false)
        }
    }

    if (isLoading) return <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-4 border-green-600 border-t-transparent"></div></div>

    return (
        <div className="space-y-6">
            <button
                onClick={() => router.back()}
                className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
            </button>

            <Card className="border-zinc-800 bg-zinc-900/40">
                <CardHeader>
                    <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-green-500" />
                        <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                            Logging as {currentId === 'user-1' ? 'Partner A' : 'Partner B'}
                        </span>
                    </div>
                    <CardTitle className="text-2xl font-bold">Log Daily Progress</CardTitle>
                    <CardDescription>Record your achievements for the day.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">Course Day</label>
                            <Input
                                type="number"
                                min="1"
                                max="100"
                                value={formData.courseDay}
                                onChange={(e) => setFormData(prev => ({ ...prev, courseDay: parseInt(e.target.value) }))}
                                required
                            />
                        </div>

                        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 shadow-inner">
                            <Toggle
                                label="Watched Lectures"
                                checked={formData.watched}
                                onChange={(e) => setFormData(prev => ({ ...prev, watched: e.target.checked }))}
                            />
                            <Toggle
                                label="Practiced Code"
                                checked={formData.practiced}
                                onChange={(e) => setFormData(prev => ({ ...prev, practiced: e.target.checked }))}
                            />
                            <Toggle
                                label="Project Completed"
                                checked={formData.projectDone}
                                onChange={(e) => setFormData(prev => ({ ...prev, projectDone: e.target.checked }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">Time Spent (minutes)</label>
                            <Input
                                type="number"
                                value={formData.timeSpentMinutes}
                                onChange={(e) => setFormData(prev => ({ ...prev, timeSpentMinutes: parseInt(e.target.value) }))}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-400">Notes (Optional)</label>
                            <textarea
                                className="flex w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 min-h-[100px] transition-all"
                                placeholder="What did you learn today?"
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                            />
                        </div>

                        <Button type="submit" className="w-full h-12 gap-2 text-lg shadow-green-900/10" disabled={loading}>
                            <Send className="h-4 w-4" />
                            {loading ? 'Saving...' : 'Submit Log'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
