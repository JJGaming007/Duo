"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Heart, Send, Sparkles, Gamepad2, RotateCcw, BellRing } from 'lucide-react'
import { useIdentity } from '@/lib/identity'
import { getUserName } from '@/lib/constants'
import { pusherClient } from '@/lib/pusher'
import { toast } from 'react-hot-toast'
import useSWR from 'swr'
import { cn } from '@/lib/utils'
import { showOsNotification, requestNotificationPermission } from '@/lib/notifications'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export default function BondPage() {
    const { currentId } = useIdentity()
    const [note, setNote] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { data: initialNotes, mutate } = useSWR('/api/bond', fetcher)
    const [liveNotes, setLiveNotes] = useState<any[]>([])

    // Tic-Tac-Toe state
    const [board, setBoard] = useState(Array(9).fill(null))
    const [xIsNext, setXIsNext] = useState(true)

    useEffect(() => {
        if (initialNotes) {
            setLiveNotes(initialNotes)
        }
    }, [initialNotes])

    useEffect(() => {
        if (!currentId) return

        // Love Notes Channel
        const noteChannel = pusherClient.subscribe('bond-update')

        noteChannel.bind('new-note', (newNote: any) => {
            setLiveNotes(prev => [newNote, ...prev])
            if (newNote.senderId !== currentId) {
                toast(`New note from ${newNote.senderName}! 💖`, { icon: '💌' })
                if (document.hidden) {
                    showOsNotification('CodeTrack Duo', { body: `New note from ${newNote.senderName}! 💖` })
                }
            }
        })

        noteChannel.bind('nudge', (data: any) => {
            if (data.senderId !== currentId) {
                toast(`${data.senderName} nudged you! 👋`, { icon: '🔔' })
                if (document.hidden) {
                    showOsNotification('CodeTrack Duo', { body: `${data.senderName} nudged you! 👋` })
                }
            }
        })

        // Tic Tac Toe Channel
        const tttChannel = pusherClient.subscribe('bond-tictactoe')
        tttChannel.bind('game-update', (data: any) => {
            if (data.type === 'move') {
                setBoard(data.board)
                setXIsNext(data.xIsNext)
            } else if (data.type === 'reset') {
                setBoard(Array(9).fill(null))
                setXIsNext(true)
                if (data.senderId !== currentId) {
                    toast(`${getUserName(data.senderId)} restarted the game! 🎮`, { icon: '🔄' })
                }
            }
        })

        return () => {
            pusherClient.unsubscribe('bond-update')
            pusherClient.unsubscribe('bond-tictactoe')
        }
    }, [currentId])

    const handleSendNote = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!note.trim() || !currentId) return

        setIsSubmitting(true)
        requestNotificationPermission()
        try {
            const res = await fetch('/api/bond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId: currentId, content: note }),
            })
            if (res.ok) {
                setNote('')
            }
        } catch (error) {
            toast.error("Failed to send note.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleNudge = async () => {
        if (!currentId) return;
        toast.success("Nudge sent! 👋")
        requestNotificationPermission()
        try {
            await fetch('/api/bond/nudge', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId: currentId })
            })
        } catch (error) {
            console.error(error)
        }
    }

    const checkWinner = (squares: any[]) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
            [0, 4, 8], [2, 4, 6] // diagonals
        ]
        for (let i = 0; i < lines.length; i++) {
            const [a, b, c] = lines[i]
            if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return squares[a]
            }
        }
        return null
    }

    const winner = checkWinner(board)
    const isDraw = !winner && board.every(square => square !== null)
    const isMyTurn = currentId === 'user-1' ? xIsNext : !xIsNext

    const handlePlay = async (i: number) => {
        if (board[i] || winner || !isMyTurn) return

        const newBoard = [...board]
        newBoard[i] = xIsNext ? 'X' : 'O'
        const nextXIsNext = !xIsNext

        // Optimistic update
        setBoard(newBoard)
        setXIsNext(nextXIsNext)

        // Broadcast move
        await fetch('/api/bond/tictactoe', {
            method: 'POST',
            body: JSON.stringify({ type: 'move', board: newBoard, xIsNext: nextXIsNext, senderId: currentId })
        })
    }

    const handleResetGame = async () => {
        setBoard(Array(9).fill(null))
        setXIsNext(true)
        await fetch('/api/bond/tictactoe', {
            method: 'POST',
            body: JSON.stringify({ type: 'reset', senderId: currentId })
        })
    }

    return (
        <div className="space-y-8 pb-[100px]">
            <header className="flex flex-col gap-2 relative">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-pink-500/20 flex items-center justify-center border border-pink-500/30">
                            <Heart className="h-5 w-5 text-pink-500 fill-pink-500" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Connect</h1>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleNudge} className="gap-2 border-zinc-700 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 shadow-lg">
                        <BellRing className="h-4 w-4" />
                        <span className="hidden sm:inline">Nudge Partner</span>
                    </Button>
                </div>
                <p className="text-zinc-400">A special place just for the two of you.</p>
            </header>

            <div className="grid gap-6 md:grid-cols-2">

                {/* Love Notes Section */}
                <div className="space-y-6">
                    <Card className="border-pink-900/40 bg-pink-950/10 shadow-lg shadow-pink-900/10">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-pink-400" />
                                Leave a Note
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSendNote} className="space-y-4">
                                <textarea
                                    className="flex w-full rounded-xl border border-pink-900/50 bg-pink-950/30 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 min-h-[100px] transition-all resize-none shadow-inner"
                                    placeholder="Write something sweet..."
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    maxLength={280}
                                />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-zinc-500">{note.length}/280</span>
                                    <Button
                                        className="bg-pink-600 hover:bg-pink-700 text-white gap-2 shadow-lg shadow-pink-900/50"
                                        disabled={isSubmitting || !note.trim()}
                                    >
                                        <Send className="h-4 w-4" />
                                        Send Note
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>

                    <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {liveNotes.map((n: any) => (
                            <Card key={n.id} className={cn(
                                "border-zinc-800 transition-all duration-300",
                                n.senderId === currentId ? "bg-zinc-900/60 ml-8" : "bg-zinc-900/30 mr-8"
                            )}>
                                <CardContent className="p-4 space-y-2">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className={cn(
                                            "font-bold",
                                            n.senderId === currentId ? "text-pink-400" : "text-blue-400"
                                        )}>
                                            {n.senderName}
                                        </span>
                                        <span className="text-zinc-500">
                                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-sm text-zinc-300 whitespace-pre-wrap">{n.content}</p>
                                </CardContent>
                            </Card>
                        ))}
                        {!liveNotes.length && (
                            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                                No notes yet. Be the first to say hi! 👋
                            </div>
                        )}
                    </div>
                </div>

                {/* Tic Tac Toe Section */}
                <Card className="border-blue-900/30 bg-blue-950/10 sticky top-24 self-start">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Gamepad2 className="h-5 w-5 text-blue-400" />
                            Tic-Tac-Toe
                        </CardTitle>
                        <Button variant="ghost" size="icon" onClick={handleResetGame} className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                            <RotateCcw className="h-4 w-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center gap-6">

                        <div className="flex items-center gap-4 text-sm font-medium">
                            <div className={cn("px-4 py-2 rounded-xl transition-all", xIsNext ? "bg-blue-600 shadow-lg shadow-blue-900/50" : "bg-zinc-900 text-zinc-500")}>
                                Player X
                            </div>
                            <span className="text-zinc-600 font-bold">VS</span>
                            <div className={cn("px-4 py-2 rounded-xl transition-all", !xIsNext ? "bg-pink-600 shadow-lg shadow-pink-900/50" : "bg-zinc-900 text-zinc-500")}>
                                Player O
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 w-full max-w-[300px] aspect-square bg-zinc-800 p-2 rounded-2xl shadow-inner">
                            {board.map((square, i) => (
                                <button
                                    key={i}
                                    onClick={() => handlePlay(i)}
                                    disabled={square || winner || !isMyTurn}
                                    className={cn(
                                        "h-full w-full bg-zinc-900 rounded-xl flex items-center justify-center text-5xl font-black transition-all duration-300",
                                        !square && isMyTurn && !winner ? "hover:bg-zinc-700 cursor-pointer" : "cursor-default",
                                        square === 'X' ? "text-blue-500 drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" : "",
                                        square === 'O' ? "text-pink-500 drop-shadow-[0_0_15px_rgba(236,72,153,0.3)]" : ""
                                    )}
                                >
                                    {square && <span className="duration-300">{square}</span>}
                                </button>
                            ))}
                        </div>

                        <div className="h-8 flex items-center justify-center">
                            {winner ? (
                                <span className="text-lg font-bold text-green-400 animate-bounce">
                                    Player {winner} Wins! 🏆
                                </span>
                            ) : isDraw ? (
                                <span className="text-lg font-bold text-zinc-400">
                                    It&apos;s a Draw! 🤝
                                </span>
                            ) : (
                                <span className={cn(
                                    "text-sm",
                                    isMyTurn ? "text-green-400 font-bold" : "text-zinc-500"
                                )}>
                                    {isMyTurn ? "Your turn!" : "Waiting for partner..."}
                                </span>
                            )}
                        </div>

                    </CardContent>
                </Card>

            </div>
        </div>
    )
}
