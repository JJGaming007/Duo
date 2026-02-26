"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Loader2, User, MessageCircle, Gamepad2, Heart, Send, Sparkles, BellRing, RotateCcw, CheckCheck, Reply, Trash2, X, SmilePlus } from 'lucide-react'
import { useIdentity } from '@/lib/identity'
import { getUserName } from '@/lib/constants'
import { pusherClient } from '@/lib/pusher'
import { toast } from 'react-hot-toast'
import useSWR from 'swr'
import { cn } from '@/lib/utils'

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Reaction emoji options
const REACTION_EMOJIS = ['❤️', '😂', '😢', '🔥', '👏', '😮']
const QUICK_EMOJIS = ['❤️', '🥰', '😘', '💕', '🫂', '✨', '👏', '🔥']
const MOOD_OPTIONS = [
    { emoji: '🎯', label: 'Focused' },
    { emoji: '😊', label: 'Happy' },
    { emoji: '😎', label: 'Chill' },
    { emoji: '💪', label: 'Motivated' },
    { emoji: '😴', label: 'Sleepy' },
    { emoji: '😰', label: 'Stressed' },
    { emoji: '🤔', label: 'Thinking' },
    { emoji: '🎉', label: 'Celebrating' },
]

// Date formatting helpers
const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Group messages by date
const groupMessagesByDate = (messages: any[]) => {
    const groups: { date: string; messages: any[] }[] = []
    let currentDate = ''

    const sorted = [...messages].reverse()

    sorted.forEach(msg => {
        const msgDate = new Date(msg.createdAt).toDateString()
        if (msgDate !== currentDate) {
            currentDate = msgDate
            groups.push({ date: msg.createdAt, messages: [msg] })
        } else {
            groups[groups.length - 1].messages.push(msg)
        }
    })

    return groups
}

export default function BondPage() {
    const { currentId } = useIdentity()
    const [note, setNote] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { data: initialNotes, mutate } = useSWR('/api/bond', fetcher)
    const [liveNotes, setLiveNotes] = useState<any[]>([])
    const [partnerTyping, setPartnerTyping] = useState(false)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const lastTypingSentRef = useRef(0)

    // New feature state
    const [reactions, setReactions] = useState<Record<string, string[]>>({})
    const [replyTo, setReplyTo] = useState<any | null>(null)
    const [showReactionPicker, setShowReactionPicker] = useState<string | null>(null)
    const [myMood, setMyMood] = useState<{ emoji: string; label: string } | null>(null)
    const [partnerMood, setPartnerMood] = useState<{ emoji: string; label: string } | null>(null)
    const [showMoodPicker, setShowMoodPicker] = useState(false)
    const [showQuickEmojis, setShowQuickEmojis] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

    const [board, setBoard] = useState(Array(9).fill(null))
    const [xIsNext, setXIsNext] = useState(true)
    const [activeTab, setActiveTab] = useState<'messages' | 'games'>('messages')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const messageContainerRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Auto-resize textarea
    const autoResize = useCallback(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = '44px'
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px'
        }
    }, [])

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }

    useEffect(() => {
        if (activeTab === 'messages' && liveNotes.length > 0) {
            scrollToBottom()
        }
    }, [liveNotes, activeTab])

    // Load from localStorage immediately
    useEffect(() => {
        const savedNotes = localStorage.getItem('bond-messages')
        const savedBoard = localStorage.getItem('bond-board')
        const savedXIsNext = localStorage.getItem('bond-xIsNext')
        const savedReactions = localStorage.getItem('bond-reactions')
        const savedMood = localStorage.getItem('bond-my-mood')

        if (savedNotes) setLiveNotes(JSON.parse(savedNotes))
        if (savedBoard) setBoard(JSON.parse(savedBoard))
        if (savedXIsNext) setXIsNext(JSON.parse(savedXIsNext))
        if (savedReactions) setReactions(JSON.parse(savedReactions))
        if (savedMood) setMyMood(JSON.parse(savedMood))
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

    // Persist reactions
    useEffect(() => {
        if (Object.keys(reactions).length > 0) {
            localStorage.setItem('bond-reactions', JSON.stringify(reactions))
        }
    }, [reactions])

    useEffect(() => {
        if (!currentId) return

        const noteChannel = pusherClient.subscribe('bond-update')

        noteChannel.bind('new-note', (newNote: any) => {
            setLiveNotes(prev => [newNote, ...prev])
            if (newNote.senderId !== currentId) {
                toast(`New note from ${newNote.senderName}! 💖`, { icon: '💌' })
                setPartnerTyping(false)
            }
        })

        noteChannel.bind('nudge', (data: any) => {
            if (data.senderId !== currentId) {
                toast(`${data.senderName} nudged you! 👋`, { icon: '🔔' })
            }
        })

        noteChannel.bind('typing', (data: any) => {
            if (data.senderId !== currentId) {
                setPartnerTyping(true)
                if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
                typingTimeoutRef.current = setTimeout(() => setPartnerTyping(false), 3000)
            }
        })

        // Listen for reactions from partner
        noteChannel.bind('reaction', (data: any) => {
            if (data.senderId !== currentId) {
                setReactions(prev => {
                    const msgReactions = prev[data.messageId] || []
                    if (msgReactions.includes(data.emoji)) return prev
                    return { ...prev, [data.messageId]: [...msgReactions, data.emoji] }
                })
            }
        })

        // Listen for mood updates from partner
        noteChannel.bind('mood', (data: any) => {
            if (data.senderId !== currentId) {
                setPartnerMood({ emoji: data.emoji, label: data.label })
            }
        })

        // Listen for message deletes
        noteChannel.bind('delete-note', (data: any) => {
            setLiveNotes(prev => prev.filter(n => n.id !== data.messageId))
        })

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
        try {
            const res = await fetch('/api/bond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    senderId: currentId,
                    content: note,
                    replyTo: replyTo ? { id: replyTo.id, content: replyTo.content?.substring(0, 80), senderName: replyTo.senderName } : undefined,
                }),
            })
            if (res.ok) {
                setNote('')
                setReplyTo(null)
                if (textareaRef.current) {
                    textareaRef.current.style.height = '44px'
                }
            }
        } catch (error) {
            toast.error("Failed to send note.")
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleQuickEmoji = async (emoji: string) => {
        if (!currentId) return
        setShowQuickEmojis(false)
        try {
            await fetch('/api/bond', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ senderId: currentId, content: emoji }),
            })
        } catch (error) {
            toast.error("Failed to send emoji.")
        }
    }

    const handleTyping = () => {
        if (!currentId) return
        const now = Date.now()
        if (now - lastTypingSentRef.current < 2000) return
        lastTypingSentRef.current = now
        fetch('/api/bond/nudge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: currentId, type: 'typing' })
        }).catch(() => { })
    }

    const handleNudge = async () => {
        if (!currentId) return;
        toast.success("Nudge sent! 👋")
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

    const handleReaction = async (messageId: string, emoji: string) => {
        if (!currentId) return
        setShowReactionPicker(null)

        // Update local state
        setReactions(prev => {
            const msgReactions = prev[messageId] || []
            if (msgReactions.includes(emoji)) {
                // Toggle off
                return { ...prev, [messageId]: msgReactions.filter(e => e !== emoji) }
            }
            return { ...prev, [messageId]: [...msgReactions, emoji] }
        })

        // Broadcast via Pusher
        fetch('/api/bond/nudge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: currentId, type: 'reaction', messageId, emoji })
        }).catch(() => { })
    }

    const handleSetMood = async (mood: { emoji: string; label: string }) => {
        if (!currentId) return
        setMyMood(mood)
        setShowMoodPicker(false)
        localStorage.setItem('bond-my-mood', JSON.stringify(mood))

        fetch('/api/bond/nudge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ senderId: currentId, type: 'mood', ...mood })
        }).catch(() => { })
    }

    const handleDeleteMessage = async (messageId: string) => {
        setDeleteConfirm(null)
        setLiveNotes(prev => prev.filter(n => n.id !== messageId))
        try {
            await fetch('/api/bond', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messageId, senderId: currentId })
            })
        } catch (error) {
            toast.error("Failed to delete message")
        }
    }

    const checkWinner = (squares: any[]) => {
        const lines = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8],
            [0, 3, 6], [1, 4, 7], [2, 5, 8],
            [0, 4, 8], [2, 4, 6]
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

        setBoard(newBoard)
        setXIsNext(nextXIsNext)

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

    const messageGroups = groupMessagesByDate(liveNotes)
    const partnerName = currentId === 'user-1' ? getUserName('user-2') : getUserName('user-1')

    return (
        <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-[750px] mx-auto max-w-5xl overflow-hidden relative">

            {/* Header */}
            <header className="flex items-center justify-between shrink-0 px-4 md:px-5 py-2.5 md:py-3 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800 z-20">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="h-9 w-9 md:h-10 md:w-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm md:text-base shadow-lg shadow-pink-900/30">
                            {partnerName.charAt(0).toUpperCase()}
                        </div>
                        {/* Online dot */}
                        <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-zinc-900" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-[15px] md:text-base font-bold text-white leading-tight tracking-tight">{partnerName}</h1>
                            {partnerMood && (
                                <span className="text-xs bg-zinc-800 px-1.5 py-0.5 rounded-full border border-zinc-700/50">
                                    {partnerMood.emoji}
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] leading-tight">
                            {partnerTyping
                                ? <span className="text-green-400 animate-pulse">typing...</span>
                                : partnerMood
                                    ? <span className="text-zinc-500">{partnerMood.label} {partnerMood.emoji}</span>
                                    : <span className="text-zinc-500">your partner 💕</span>
                            }
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {/* Mood picker */}
                    <div className="relative">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShowMoodPicker(!showMoodPicker)}
                            className="h-9 w-9 rounded-xl text-zinc-400 hover:text-purple-400 hover:bg-purple-500/10 transition-all"
                            title="Set Mood"
                        >
                            <span className="text-base">{myMood?.emoji || '😊'}</span>
                        </Button>
                        {showMoodPicker && (
                            <div className="absolute right-0 top-11 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-3 z-50 min-w-[200px] animate-in fade-in slide-in-from-top-2 duration-200">
                                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-2 px-1">Set your mood</p>
                                <div className="grid grid-cols-4 gap-1">
                                    {MOOD_OPTIONS.map(mood => (
                                        <button
                                            key={mood.label}
                                            onClick={() => handleSetMood(mood)}
                                            className={cn(
                                                "flex flex-col items-center gap-0.5 p-2 rounded-xl transition-all hover:bg-zinc-800",
                                                myMood?.label === mood.label && "bg-zinc-800 ring-1 ring-purple-500/30"
                                            )}
                                        >
                                            <span className="text-lg">{mood.emoji}</span>
                                            <span className="text-[8px] text-zinc-500 font-medium">{mood.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNudge}
                        className="h-9 w-9 rounded-xl text-zinc-400 hover:text-yellow-400 hover:bg-yellow-500/10 transition-all"
                        title="Send Nudge"
                    >
                        <BellRing className="h-[18px] w-[18px]" />
                    </Button>
                </div>
            </header>

            {/* Sub Tabs */}
            <div className="px-0 shrink-0 bg-zinc-900/60 backdrop-blur-lg border-b border-zinc-800/50 z-10">
                <div className="flex relative">
                    <button
                        onClick={() => setActiveTab('messages')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] md:text-xs font-bold uppercase tracking-wider transition-all relative",
                            activeTab === 'messages' ? "text-green-400" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        <MessageCircle className={cn("h-3.5 w-3.5", activeTab === 'messages' && "fill-green-400/20")} />
                        Messages
                    </button>
                    <button
                        onClick={() => setActiveTab('games')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] md:text-xs font-bold uppercase tracking-wider transition-all relative",
                            activeTab === 'games' ? "text-green-400" : "text-zinc-500 hover:text-zinc-300"
                        )}
                    >
                        <Gamepad2 className={cn("h-3.5 w-3.5", activeTab === 'games' && "fill-green-400/20")} />
                        Games
                    </button>
                    {/* Active tab indicator */}
                    <div
                        className={cn(
                            "absolute bottom-0 h-[2px] w-1/2 bg-green-500 rounded-t-full transition-all duration-300 ease-out",
                            activeTab === 'games' ? "translate-x-full" : "translate-x-0"
                        )}
                    />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-h-0 relative">
                {activeTab === 'messages' ? (
                    <>
                        {/* Chat Messages */}
                        <div
                            ref={messageContainerRef}
                            className="flex-1 overflow-y-auto px-3 md:px-4 py-3 custom-scrollbar bg-zinc-950/50"
                            onClick={() => { setShowReactionPicker(null); setDeleteConfirm(null) }}
                        >
                            <div className="max-w-3xl mx-auto w-full space-y-1">
                                {/* Date-grouped messages */}
                                {messageGroups.map((group, gi) => (
                                    <div key={gi}>
                                        {/* Date Separator */}
                                        <div className="flex items-center justify-center my-3">
                                            <div className="bg-zinc-800/80 backdrop-blur-sm px-3 py-1 rounded-full border border-zinc-700/50">
                                                <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                                                    {formatMessageDate(group.date)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Messages in this date group */}
                                        {group.messages.map((n: any, mi: number) => {
                                            const isMine = n.senderId === currentId
                                            const isConsecutive = mi > 0 && group.messages[mi - 1].senderId === n.senderId
                                            const msgReactions = reactions[n.id] || []
                                            const isOnlyEmoji = /^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]{1,3}$/u.test(n.content?.trim() || '')

                                            return (
                                                <div
                                                    key={n.id || mi}
                                                    className={cn(
                                                        "flex w-full group/msg",
                                                        isMine ? "justify-end" : "justify-start",
                                                        isConsecutive ? "mt-[3px]" : "mt-2.5"
                                                    )}
                                                >
                                                    <div className="relative max-w-[80%] md:max-w-[65%]">
                                                        {/* Sender Name (only for partner, first in group) */}
                                                        {!isMine && !isConsecutive && (
                                                            <p className="text-[11px] text-pink-400 font-semibold mb-1 ml-3">
                                                                {n.senderName || partnerName}
                                                            </p>
                                                        )}

                                                        {/* Reply preview if this is a reply */}
                                                        {n.replyTo && (
                                                            <div className={cn(
                                                                "mx-3 mb-1 px-3 py-1.5 rounded-xl text-[11px] border-l-2",
                                                                isMine
                                                                    ? "bg-green-900/10 border-green-500/40 text-green-300/60"
                                                                    : "bg-zinc-800/40 border-pink-500/40 text-zinc-400"
                                                            )}>
                                                                <span className="font-semibold text-[10px]">{n.replyTo.senderName}</span>
                                                                <p className="truncate">{n.replyTo.content}</p>
                                                            </div>
                                                        )}

                                                        {/* Message Bubble */}
                                                        <div
                                                            className={cn(
                                                                "relative rounded-2xl shadow-sm",
                                                                isOnlyEmoji
                                                                    ? "bg-transparent border-none px-2 py-1"
                                                                    : cn(
                                                                        "px-3.5 py-2 md:px-4 md:py-2.5",
                                                                        isMine
                                                                            ? "bg-green-600/15 border border-green-500/20 rounded-br-md"
                                                                            : "bg-zinc-800/80 border border-zinc-700/40 rounded-bl-md"
                                                                    )
                                                            )}
                                                            onDoubleClick={(e) => {
                                                                e.stopPropagation()
                                                                setShowReactionPicker(showReactionPicker === n.id ? null : n.id)
                                                            }}
                                                        >
                                                            {/* Content + Timestamp */}
                                                            <div className="flex items-end gap-2">
                                                                <p className={cn(
                                                                    "text-zinc-100 whitespace-pre-wrap leading-[1.4] flex-1 break-words",
                                                                    isOnlyEmoji ? "text-4xl md:text-5xl" : "text-[14px] md:text-[15px]"
                                                                )}>
                                                                    {n.content}
                                                                </p>
                                                                {!isOnlyEmoji && (
                                                                    <div className="flex items-center gap-0.5 shrink-0 -mb-0.5 ml-1">
                                                                        <span className="text-[10px] text-zinc-500 leading-none">
                                                                            {formatTime(n.createdAt)}
                                                                        </span>
                                                                        {isMine && (
                                                                            <CheckCheck className="h-3.5 w-3.5 text-green-400 ml-0.5" />
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Action buttons on hover */}
                                                            <div className={cn(
                                                                "absolute top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity",
                                                                isMine ? "-left-20" : "-right-20"
                                                            )}>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setReplyTo(n) }}
                                                                    className="h-7 w-7 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                                                                    title="Reply"
                                                                >
                                                                    <Reply className="h-3 w-3" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setShowReactionPicker(showReactionPicker === n.id ? null : n.id) }}
                                                                    className="h-7 w-7 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all"
                                                                    title="React"
                                                                >
                                                                    <SmilePlus className="h-3 w-3" />
                                                                </button>
                                                                {isMine && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            if (deleteConfirm === n.id) {
                                                                                handleDeleteMessage(n.id)
                                                                            } else {
                                                                                setDeleteConfirm(n.id)
                                                                                setTimeout(() => setDeleteConfirm(null), 3000)
                                                                            }
                                                                        }}
                                                                        className={cn(
                                                                            "h-7 w-7 rounded-lg border flex items-center justify-center transition-all",
                                                                            deleteConfirm === n.id
                                                                                ? "bg-red-600/20 border-red-500/50 text-red-400"
                                                                                : "bg-zinc-800/80 border-zinc-700/50 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                                                                        )}
                                                                        title={deleteConfirm === n.id ? "Click again to confirm" : "Delete"}
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Reaction Picker */}
                                                        {showReactionPicker === n.id && (
                                                            <div
                                                                className={cn(
                                                                    "absolute z-50 flex items-center gap-0.5 bg-zinc-900 border border-zinc-700 rounded-full px-2 py-1 shadow-2xl animate-in fade-in zoom-in-95 duration-150",
                                                                    isMine ? "right-0 -bottom-10" : "left-0 -bottom-10"
                                                                )}
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {REACTION_EMOJIS.map(emoji => (
                                                                    <button
                                                                        key={emoji}
                                                                        onClick={() => handleReaction(n.id, emoji)}
                                                                        className={cn(
                                                                            "text-lg hover:scale-125 transition-transform p-1 rounded-full",
                                                                            msgReactions.includes(emoji) && "bg-zinc-800"
                                                                        )}
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {/* Reactions display */}
                                                        {msgReactions.length > 0 && (
                                                            <div className={cn("flex items-center gap-0.5 mt-0.5", isMine ? "justify-end mr-2" : "justify-start ml-2")}>
                                                                <div className="flex items-center bg-zinc-800/80 border border-zinc-700/40 rounded-full px-1.5 py-0.5 gap-0.5">
                                                                    {msgReactions.map((emoji, i) => (
                                                                        <span key={i} className="text-xs">{emoji}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}

                                {/* Typing Indicator */}
                                {partnerTyping && (
                                    <div className="flex justify-start mt-2.5">
                                        <div className="bg-zinc-800/80 border border-zinc-700/40 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                            <div className="flex gap-1 items-center">
                                                <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                <div className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Reply Preview Bar */}
                        {replyTo && (
                            <div className="px-3 md:px-4 py-2 bg-zinc-900/90 border-t border-zinc-800 flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200 shrink-0">
                                <div className="h-8 w-1 rounded-full bg-green-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] text-green-400 font-bold">{replyTo.senderName || (replyTo.senderId === currentId ? getUserName(currentId || 'user-1') : partnerName)}</p>
                                    <p className="text-[12px] text-zinc-400 truncate">{replyTo.content}</p>
                                </div>
                                <button onClick={() => setReplyTo(null)} className="text-zinc-500 hover:text-white transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {/* Input Bar */}
                        <div className="px-2 md:px-3 py-2 md:py-2.5 bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-800 shrink-0 safe-pb">
                            <form onSubmit={handleSendNote} className="flex gap-2 max-w-3xl mx-auto items-end">
                                {/* Quick Emoji Toggle */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickEmojis(!showQuickEmojis)}
                                        className={cn(
                                            "h-[44px] w-[44px] rounded-xl flex items-center justify-center shrink-0 transition-all",
                                            showQuickEmojis ? "bg-pink-500/10 text-pink-400" : "text-zinc-500 hover:text-zinc-300"
                                        )}
                                    >
                                        <Heart className="h-5 w-5" />
                                    </button>
                                    {showQuickEmojis && (
                                        <div className="absolute bottom-14 left-0 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-2 flex gap-1 animate-in fade-in slide-in-from-bottom-2 duration-200 z-50">
                                            {QUICK_EMOJIS.map(emoji => (
                                                <button
                                                    key={emoji}
                                                    type="button"
                                                    onClick={() => handleQuickEmoji(emoji)}
                                                    className="text-xl hover:scale-125 transition-transform p-1.5 rounded-xl hover:bg-zinc-800"
                                                >
                                                    {emoji}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 flex items-center bg-zinc-800 border border-zinc-700/50 rounded-2xl px-4 min-h-[44px] focus-within:border-green-500/30 transition-colors">
                                    <textarea
                                        ref={textareaRef}
                                        className="flex-1 bg-transparent py-3 px-1 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-none leading-[1.4] max-h-[120px] overflow-y-hidden custom-scrollbar-thin"
                                        placeholder="Type a message..."
                                        rows={1}
                                        value={note}
                                        onChange={(e) => {
                                            setNote(e.target.value)
                                            autoResize()
                                            handleTyping()
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSendNote(e)
                                            }
                                        }}
                                        style={{ height: '44px' }}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !note.trim()}
                                    className={cn(
                                        "h-[44px] w-[44px] rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90",
                                        note.trim()
                                            ? "bg-green-600 hover:bg-green-500 shadow-lg shadow-green-900/30"
                                            : "bg-zinc-800 border border-zinc-700/50 cursor-not-allowed"
                                    )}
                                >
                                    {isSubmitting
                                        ? <Loader2 className="h-5 w-5 text-white animate-spin" />
                                        : <Send className={cn("h-5 w-5 ml-0.5", note.trim() ? "text-white" : "text-zinc-600")} />
                                    }
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 overflow-y-auto custom-scrollbar-thin bg-zinc-950/50">
                        <div className="w-full max-w-[320px] md:max-w-sm space-y-6 md:space-y-8 py-4">
                            <div className="flex items-center justify-between text-zinc-400">
                                <div className="flex items-center gap-2">
                                    <div className={cn("h-1.5 w-1.5 rounded-full", xIsNext ? "bg-blue-500 animate-pulse" : "bg-zinc-800")} />
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Player X</span>
                                </div>
                                <span className="text-[9px] font-black text-zinc-700">VS</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60 text-right">Player O</span>
                                    <div className={cn("h-1.5 w-1.5 rounded-full", !xIsNext ? "bg-pink-500 animate-pulse" : "bg-zinc-800")} />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 md:gap-2 aspect-square">
                                {board.map((square, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handlePlay(i)}
                                        disabled={!!square || !!winner || !isMyTurn}
                                        className={cn(
                                            "aspect-square bg-zinc-800/80 rounded-xl md:rounded-2xl flex items-center justify-center text-2xl md:text-4xl font-black transition-all duration-300 border border-zinc-700/50",
                                            !square && isMyTurn && !winner ? "hover:bg-zinc-700/80 cursor-pointer shadow-lg" : "cursor-default",
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
                                    className="gap-2 text-zinc-500 hover:text-white hover:bg-zinc-800 text-[8px] font-black uppercase tracking-widest transition-all h-8"
                                >
                                    <RotateCcw className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                    Reset Game
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Close any open pickers when clicking outside */}
            {(showMoodPicker || showQuickEmojis) && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => { setShowMoodPicker(false); setShowQuickEmojis(false) }}
                />
            )}
        </div>
    )
}
