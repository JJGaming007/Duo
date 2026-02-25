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
        // With flex-col-reverse, we just scroll to the container's bottom (which is visually the end)
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }

    useEffect(() => {
        if (activeTab === 'messages' && liveNotes.length > 0) {
            scrollToBottom()
        }
    }, [liveNotes, activeTab])

    useEffect(() => {
        // Load from localStorage immediately
        const savedNotes = localStorage.getItem('bond-messages')
        const savedBoard = localStorage.getItem('bond-board')
        const savedXIsNext = localStorage.getItem('bond-xIsNext')

        if (savedNotes) setLiveNotes(JSON.parse(savedNotes))
        if (savedBoard) setBoard(JSON.parse(savedBoard))
        if (savedXIsNext) setXIsNext(JSON.parse(savedXIsNext))
    }, [])

    useEffect(() => {
        if (initialNotes) {
            setLiveNotes(initialNotes)
            localStorage.setItem('bond-messages', JSON.stringify(initialNotes))
        }
    }, [initialNotes])

    useEffect(() => {
        if (liveNotes.length > 0) {
            localStorage.setItem('bond-messages', JSON.stringify(liveNotes))
        }
    }, [liveNotes])

    useEffect(() => {
        localStorage.setItem('bond-board', JSON.stringify(board))
        localStorage.setItem('bond-xIsNext', JSON.stringify(xIsNext))
    }, [board, xIsNext])

    useEffect(() => {
        if (!currentId) return

        // Love Notes Channel
        const noteChannel = pusherClient.subscribe('bond-update')

        noteChannel.bind('new-note', (newNote: any) => {
            // Add to the list (note: ordering is handled by flex-col-reverse in UI)
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
        /* 
           h-[calc(100dvh-7.5rem)] ensures the container fits between the root layout header and bottom navigation.
           Using overflow-hidden here and flex-1 overflow-y-auto on the message list creates the fixed header/footer effect.
        */
        <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-[750px] mx-auto max-w-5xl overflow-hidden relative">
            {/* 1. Fixed Header (Shrink-0 prevents it from scrolling) */}
            <header className="flex items-center justify-between shrink-0 px-4 py-2.5 md:py-3 bg-zinc-950/40 backdrop-blur-md border-b border-zinc-900/50 z-20">
                <div className="flex items-center gap-2.5 md:gap-3">
                    <div className="h-8 w-8 md:h-9 md:w-9 rounded-lg md:rounded-xl bg-pink-500/10 flex items-center justify-center border border-pink-500/20 shadow-inner">
                        <Heart className="h-4 w-4 md:h-4.5 md:w-4.5 text-pink-500 fill-pink-500/20" />
                    </div>
                    <div>
                        <h1 className="text-base md:text-xl font-bold tracking-tight text-white leading-none">Connect</h1>
                        <p className="text-[7px] md:text-[8px] text-zinc-500 mt-0.5 md:mt-1 uppercase tracking-widest font-black opacity-60">Duo Space</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNudge}
                    className="h-8 w-8 md:h-9 md:w-9 rounded-lg md:rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/50"
                >
                    <BellRing className="h-3.5 w-3.5 md:h-4 md:w-4" />
                </Button>
            </header>

            {/* 2. Fixed Sub Tabs (Shrink-0) */}
            <div className="px-3 md:px-4 py-1.5 md:py-2 shrink-0 bg-zinc-950/20 z-10">
                <div className="p-1 bg-zinc-900/30 rounded-xl md:rounded-2xl border border-zinc-800/30 backdrop-blur-sm">
                    <div className="flex relative">
                        <button
                            onClick={() => setActiveTab('messages')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 md:gap-2 py-1.5 md:py-2 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg md:rounded-xl transition-all relative z-10",
                                activeTab === 'messages' ? "text-pink-400" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <MessageCircle className={cn("h-3 w-3 md:h-3.5 md:w-3.5", activeTab === 'messages' && "fill-pink-400/10")} />
                            Messages
                        </button>
                        <button
                            onClick={() => setActiveTab('games')}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 md:gap-2 py-1.5 md:py-2 text-[9px] md:text-[10px] font-black uppercase tracking-wider rounded-lg md:rounded-xl transition-all relative z-10",
                                activeTab === 'games' ? "text-blue-400" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            <Gamepad2 className={cn("h-3 w-3 md:h-3.5 md:w-3.5", activeTab === 'games' && "fill-blue-400/10")} />
                            Games
                        </button>
                        <div
                            className={cn(
                                "absolute top-0 bottom-0 w-1/2 bg-zinc-800/50 rounded-lg md:rounded-xl transition-all duration-300 ease-out shadow-lg border border-zinc-700/30",
                                activeTab === 'games' ? "translate-x-full" : "translate-x-0"
                            )}
                        />
                    </div>
                </div>
            </div>

            {/* 3. Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0 relative">
                {activeTab === 'messages' ? (
                    <>
                        {/* Scrollable Messages - Takes remaining space with flex-1 */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col-reverse custom-scrollbar">
                            <div className="max-w-4xl mx-auto w-full space-y-4">
                                <div ref={messagesEndRef} />
                                {liveNotes.map((n: any) => (
                                    <div
                                        key={n.id}
                                        className={cn(
                                            "flex flex-col max-w-[85%] md:max-w-[70%] mb-4",
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
                            </div>
                        </div>

                        {/* Fixed Bottom Input - Shrink-0 keeps it fixed at the bottom of the container */}
                        <div className="px-4 pt-3 pb-8 md:pb-10 bg-zinc-950 border-t border-zinc-900/50 backdrop-blur-2xl shrink-0 safe-pb">
                            <form onSubmit={handleSendNote} className="flex gap-2.5 max-w-4xl mx-auto items-end">
                                <div className="flex-1 relative group">
                                    <textarea
                                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-pink-500/30 rounded-2xl py-3 px-4 pr-14 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition-all resize-none min-h-[48px] max-h-32 custom-scrollbar-thin"
                                        placeholder="Type a message..."
                                        rows={1}
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
                                    <div className="absolute right-4 bottom-3 text-[9px] text-zinc-800 font-black group-focus-within:text-pink-500/40 transition-colors">
                                        {note.length}/280
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !note.trim()}
                                    className="bg-pink-600 hover:bg-pink-500 text-white rounded-2xl w-[48px] h-[48px] p-0 shrink-0 shadow-lg active:scale-95 transition-all flex items-center justify-center"
                                >
                                    {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                                </Button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 overflow-y-auto custom-scrollbar-thin">
                        <div className="w-full max-w-[320px] md:max-w-sm space-y-6 md:space-y-8 py-4">
                            <div className="flex items-center justify-between text-zinc-400">
                                <div className="flex items-center gap-2">
                                    <div className={cn("h-1.5 w-1.5 rounded-full", xIsNext ? "bg-blue-500 animate-pulse" : "bg-zinc-800")} />
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Player X</span>
                                </div>
                                <span className="text-[9px] font-black text-zinc-800">VS</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase tracking_widest opacity-60 text-right">Player O</span>
                                    <div className={cn("h-1.5 w-1.5 rounded-full", !xIsNext ? "bg-pink-500 animate-pulse" : "bg-zinc-800")} />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 md:gap-2 aspect-square">
                                {board.map((square, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handlePlay(i)}
                                        disabled={square || winner || !isMyTurn}
                                        className={cn(
                                            "aspect-square bg-zinc-900/50 rounded-xl md:rounded-2xl flex items-center justify-center text-2xl md:text-4xl font-black transition-all duration-300 border border-zinc-800/30",
                                            !square && isMyTurn && !winner ? "hover:bg-zinc-800/80 cursor-pointer shadow-lg" : "cursor-default",
                                            square === 'X' ? "text-blue-500" : "",
                                            square === 'O' ? "text-pink-500" : ""
                                        )}
                                    >
                                        {square}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-col items-center gap-3 md:gap-4">
                                <div className="h-8 md:h-10 flex items-center justify-center">
                                    {winner ? (
                                        <div className="px-4 md:px-5 py-1.5 md:py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 font-black uppercase tracking-widest text-[9px] md:text-[10px] animate-bounce">
                                            Winner: {winner} 🏆
                                        </div>
                                    ) : isDraw ? (
                                        <div className="px-4 md:px-5 py-1.5 md:py-2 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400 font-black uppercase tracking-widest text-[9px] md:text-[10px]">
                                            Draw! 🤝
                                        </div>
                                    ) : (
                                        <div className={cn(
                                            "px-3 md:px-4 py-1.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em]",
                                            isMyTurn ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-zinc-900 text-zinc-600 border border-zinc-800"
                                        )}>
                                            {isMyTurn ? "Your Turn" : "Waiting..."}
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleResetGame}
                                    className="gap-2 text-zinc-500 hover:text-white hover:bg-zinc-900 text-[8px] font-black uppercase tracking-widest transition-all h-8"
                                >
                                    <RotateCcw className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                    Reset Game
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>



    )
}
