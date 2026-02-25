"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Play, Loader2, User, Clock, Terminal, RotateCcw, Share2, Cpu, ChevronUp, ChevronDown, CheckCircle2, MessageCircle, Gamepad2, Heart, Send, Sparkles, BellRing } from 'lucide-react'
import { useRef } from 'react'
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

    const [board, setBoard] = useState(Array(9).fill(null))
    const [xIsNext, setXIsNext] = useState(true)
    const [activeTab, setActiveTab] = useState<'messages' | 'games'>('messages')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    useEffect(() => {
        if (activeTab === 'messages' && liveNotes.length > 0) {
            scrollToBottom()
        }
    }, [liveNotes, activeTab])

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
        <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[750px] space-y-4 max-w-5xl mx-auto">
            <header className="flex items-center justify-between shrink-0 px-1">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20">
                        <Heart className="h-5 w-5 text-pink-500 fill-pink-500" />
                    </div>
                    <div>
                        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white leading-none">Connect</h1>
                        <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold">Bonding Space</p>
                    </div>
                </div>
                <Button variant="ghost" size="icon" onClick={handleNudge} className="h-10 w-10 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800">
                    <BellRing className="h-4 w-4" />
                </Button>
            </header>

            {/* Sub Tabs */}
            <div className="flex p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50 shrink-0">
                <button
                    onClick={() => setActiveTab('messages')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
                        activeTab === 'messages' ? "bg-zinc-800 text-pink-400 shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    <MessageCircle className="h-4 w-4" />
                    Messages
                </button>
                <button
                    onClick={() => setActiveTab('games')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all",
                        activeTab === 'games' ? "bg-zinc-800 text-blue-400 shadow-lg" : "text-zinc-500 hover:text-zinc-300"
                    )}
                >
                    <Gamepad2 className="h-4 w-4" />
                    Games
                </button>
            </div>

            <Card className="flex-1 flex flex-col bg-zinc-950/40 border-zinc-800/50 overflow-hidden relative shadow-2xl">
                {activeTab === 'messages' ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Chat Messages */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
                            {liveNotes.slice().reverse().map((n: any) => (
                                <div
                                    key={n.id}
                                    className={cn(
                                        "flex flex-col max-w-[85%] md:max-w-[70%]",
                                        n.senderId === currentId ? "ml-auto items-end" : "items-start"
                                    )}
                                >
                                    <div className={cn(
                                        "px-4 py-2.5 rounded-2xl text-sm shadow-sm transition-all",
                                        n.senderId === currentId
                                            ? "bg-pink-600 text-white rounded-br-none"
                                            : "bg-zinc-800 text-zinc-100 rounded-bl-none border border-zinc-700/50"
                                    )}>
                                        <p className="whitespace-pre-wrap leading-relaxed">{n.content}</p>
                                    </div>
                                    <span className="text-[10px] text-zinc-500 mt-1.5 px-1 font-medium">
                                        {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />

                            {!liveNotes.length && (
                                <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-3 opacity-50">
                                    <Sparkles className="h-10 w-10" />
                                    <p className="text-xs font-medium uppercase tracking-widest">No messages yet. Say something sweet!</p>
                                </div>
                            )}
                        </div>

                        {/* Sticky Input */}
                        <div className="p-4 bg-zinc-950/60 border-t border-zinc-800/50 backdrop-blur-md shrink-0">
                            <form onSubmit={handleSendNote} className="flex gap-2 max-w-3xl mx-auto">
                                <div className="flex-1 relative">
                                    <textarea
                                        className="w-full bg-zinc-900/80 border border-zinc-800 rounded-2xl py-3 px-4 pr-12 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-pink-500/30 transition-all resize-none h-12 flex items-center"
                                        placeholder="Type a message..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSendNote(e)
                                            }
                                        }}
                                        maxLength={280}
                                    />
                                    <div className="absolute right-3 bottom-3 text-[10px] text-zinc-700 font-bold">
                                        {note.length}/280
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !note.trim()}
                                    className="bg-pink-600 hover:bg-pink-700 text-white rounded-2xl w-12 h-12 p-0 shrink-0 shadow-lg shadow-pink-900/20 active:scale-95 transition-all"
                                >
                                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                </Button>
                            </form>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.05)_0,rgba(0,0,0,0)_70%)]">
                        <div className="w-full max-w-sm space-y-8">
                            <div className="flex items-center justify-between text-zinc-400">
                                <div className="flex items-center gap-2">
                                    <div className={cn("h-2.5 w-2.5 rounded-full", xIsNext ? "bg-blue-500 animate-pulse" : "bg-zinc-800")} />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Player X</span>
                                </div>
                                <span className="text-xs font-black text-zinc-700">VS</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-black uppercase tracking_widest text-right">Player O</span>
                                    <div className={cn("h-2.5 w-2.5 rounded-full", !xIsNext ? "bg-pink-500 animate-pulse" : "bg-zinc-800")} />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3 aspect-square">
                                {board.map((square, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handlePlay(i)}
                                        disabled={square || winner || !isMyTurn}
                                        className={cn(
                                            "aspect-square bg-zinc-900 rounded-2xl flex items-center justify-center text-4xl md:text-5xl font-black transition-all duration-300 border border-zinc-800/50 shadow-lg",
                                            !square && isMyTurn && !winner ? "hover:bg-zinc-800/80 cursor-pointer border-green-500/20" : "cursor-default",
                                            square === 'X' ? "text-blue-500 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]" : "",
                                            square === 'O' ? "text-pink-500 shadow-[inset_0_0_20px_rgba(236,72,153,0.1)]" : ""
                                        )}
                                    >
                                        {square}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col items-center gap-4">
                                <div className="h-10 flex items-center justify-center">
                                    {winner ? (
                                        <div className="px-6 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-black uppercase tracking-widest text-sm animate-bounce">
                                            Winner: {winner} 🏆
                                        </div>
                                    ) : isDraw ? (
                                        <div className="px-6 py-2 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-black uppercase tracking-widest text-sm">
                                            It&apos;s a Draw! 🤝
                                        </div>
                                    ) : (
                                        <div className={cn(
                                            "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em]",
                                            isMyTurn ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-zinc-900 text-zinc-600 border border-zinc-800"
                                        )}>
                                            {isMyTurn ? "Your Turn" : "Waiting..."}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={handleResetGame}
                                    className="gap-2 text-zinc-500 hover:text-white hover:bg-zinc-900 text-[10px] font-black uppercase tracking-widest transition-all"
                                >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    Reset Game
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    )
}
