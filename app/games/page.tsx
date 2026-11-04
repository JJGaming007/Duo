"use client"

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Page, PageHeader, Group } from '@/components/ui/Page'
import { bindChannel } from '@/lib/pusher'
import { useMe } from '@/lib/data'
import { getUserName } from '@/lib/constants'
import { cn } from '@/lib/utils'

type Cell = 'X' | 'O' | null
const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]

function winnerOf(b: Cell[]) {
    for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]
    return null
}

function load<T>(key: string, fallback: T): T {
    try {
        const v = localStorage.getItem(key)
        return v ? (JSON.parse(v) as T) : fallback
    } catch {
        return fallback
    }
}

export default function GamesPage() {
    const { ready, me, partnerName } = useMe()
    const [board, setBoard] = useState<Cell[]>(() => load('bond-board', Array(9).fill(null)))
    const [xIsNext, setXIsNext] = useState(() => load('bond-xIsNext', true))

    useEffect(() => {
        try {
            localStorage.setItem('bond-board', JSON.stringify(board))
            localStorage.setItem('bond-xIsNext', JSON.stringify(xIsNext))
        } catch { }
    }, [board, xIsNext])

    useEffect(() => {
        if (!ready) return
        return bindChannel('bond-tictactoe', {
            'game-update': (data: { type: string; board?: Cell[]; xIsNext?: boolean; senderId?: string }) => {
                if (data.type === 'move' && data.board) {
                    setBoard(data.board)
                    setXIsNext(!!data.xIsNext)
                } else if (data.type === 'reset') {
                    setBoard(Array(9).fill(null))
                    setXIsNext(true)
                    if (data.senderId && data.senderId !== me) toast(`${getUserName(data.senderId)} started a new game`)
                }
            },
        })
    }, [ready, me])

    const winner = winnerOf(board)
    const draw = !winner && board.every(Boolean)
    const mySymbol = me === 'user-1' ? 'X' : 'O'
    const myTurn = (me === 'user-1') === xIsNext

    const play = (i: number) => {
        if (board[i] || winner || !myTurn) return
        const next = [...board]
        next[i] = xIsNext ? 'X' : 'O'
        setBoard(next)
        setXIsNext(!xIsNext)
        fetch('/api/bond/tictactoe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'move', board: next, xIsNext: !xIsNext, senderId: me }),
        }).catch(() => { })
    }

    const reset = () => {
        setBoard(Array(9).fill(null))
        setXIsNext(true)
        fetch('/api/bond/tictactoe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'reset', senderId: me }),
        }).catch(() => { })
    }

    const status = winner
        ? winner === mySymbol ? 'You won' : `${partnerName} won`
        : draw ? "It's a draw" : myTurn ? `Your turn (${mySymbol})` : `${partnerName}'s turn`

    return (
        <Page>
            <Link href="/more" className="-ml-1 flex items-center text-[17px] text-accent">
                <ChevronLeft className="h-6 w-6" /> Settings
            </Link>
            <PageHeader title="Tic-tac-toe" />
            <Group className="flex flex-col items-center gap-5 py-6 [&>*+*]:border-0">
                <p className="text-[16px] font-semibold">{status}</p>
                <div className="grid grid-cols-3 gap-2">
                    {board.map((c, i) => (
                        <button
                            key={i}
                            onClick={() => play(i)}
                            className={cn(
                                'flex h-24 w-24 items-center justify-center rounded-xl bg-surface-2 text-4xl font-bold active:bg-line',
                                c === 'X' && 'text-me',
                                c === 'O' && 'text-partner',
                                                            )}
                        >
                            {c}
                        </button>
                    ))}
                </div>
                <button onClick={reset} className="flex items-center gap-2 text-[16px] text-accent">
                    <RotateCcw className="h-4 w-4" /> New game
                </button>
            </Group>
        </Page>
    )
}
