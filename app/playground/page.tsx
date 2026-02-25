"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Play, Loader2, User, Clock, Terminal, RotateCcw, Share2, Cpu } from 'lucide-react'
import { useIdentity } from '@/lib/identity'
import { getUserName } from '@/lib/constants'
import { pusherClient } from '@/lib/pusher'
import { cn } from '@/lib/utils'
import Script from 'next/script'

declare global {
    interface Window {
        loadPyodide: any;
    }
}

export default function PlaygroundPage() {
    const { currentId } = useIdentity()
    const [code, setCode] = useState('print("Hello Duo! 🚀\\nThis is running with Pyodide WASM in your browser.")')
    const [output, setOutput] = useState('')
    const [isRunning, setIsRunning] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [lastEditedBy, setLastEditedBy] = useState<string | null>(null)
    const [partnerPresence, setPartnerPresence] = useState(false)
    const [pyodide, setPyodide] = useState<any>(null)
    const [engineStatus, setEngineStatus] = useState<'loading' | 'ready' | 'error'>('loading')

    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const ignoreNextSyncRef = useRef(false)

    // Load Pyodide
    const initPyodide = async () => {
        if (typeof window.loadPyodide === 'undefined') return;
        try {
            const instance = await window.loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/"
            });
            setPyodide(instance);
            setEngineStatus('ready');
        } catch (error) {
            console.error('Pyodide initialization failed:', error);
            setEngineStatus('error');
        }
    };

    useEffect(() => {
        if (!currentId) return

        const channel = pusherClient.subscribe('playground')

        channel.bind('code-update', (data: any) => {
            if (data.senderId !== currentId) {
                if (data.type === 'sync') {
                    ignoreNextSyncRef.current = true
                    setCode(data.code)
                    setLastEditedBy(data.senderName)
                } else if (data.type === 'typing') {
                    setIsTyping(true)
                    setTimeout(() => setIsTyping(false), 2000)
                } else if (data.type === 'presence') {
                    setPartnerPresence(true)
                }
            }
        })

        // Broadcast presence
        fetch('/api/playground/sync', {
            method: 'POST',
            body: JSON.stringify({ type: 'presence', senderId: currentId })
        })

        return () => {
            pusherClient.unsubscribe('playground')
        }
    }, [currentId])

    const syncCode = async (newCode: string) => {
        if (!currentId) return

        try {
            await fetch('/api/playground/sync', {
                method: 'POST',
                body: JSON.stringify({
                    type: 'sync',
                    code: newCode,
                    senderId: currentId,
                    senderName: getUserName(currentId)
                })
            })
        } catch (error) {
            console.error('Failed to sync code', error)
        }
    }

    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newCode = e.target.value
        setCode(newCode)

        if (ignoreNextSyncRef.current) {
            ignoreNextSyncRef.current = false
            return
        }

        // Broadcast typing
        fetch('/api/playground/sync', {
            method: 'POST',
            body: JSON.stringify({ type: 'typing', senderId: currentId })
        })

        // Debounced sync
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => {
            syncCode(newCode)
        }, 500)
    }

    const runCode = async () => {
        if (!pyodide) return;
        setIsRunning(true)
        setOutput('')

        try {
            // Setup stdout capturing
            await pyodide.runPython(`
                import sys
                import io
                sys.stdout = io.StringIO()
                sys.stderr = io.StringIO()
            `);

            await pyodide.runPythonAsync(code);

            const stdout = await pyodide.runPython("sys.stdout.getvalue()");
            const stderr = await pyodide.runPython("sys.stderr.getvalue()");

            setOutput(stdout + (stderr ? `\nError:\n${stderr}` : ''));
        } catch (error: any) {
            setOutput(`Error: ${error.message}`);
        } finally {
            setIsRunning(false)
        }
    }

    return (
        <div className="space-y-6 pb-20">
            <Script
                src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"
                onLoad={initPyodide}
            />

            <header className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-green-500/20 flex items-center justify-center border border-green-500/30">
                            <Terminal className="h-5 w-5 text-green-500" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Python Playground</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {isTyping && (
                            <span className="text-xs text-green-500 animate-pulse bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
                                Partner is typing...
                            </span>
                        )}
                        <div className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all duration-500",
                            partnerPresence ? "bg-blue-500/10 border-blue-500/50 text-blue-400" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                        )}>
                            <div className={cn("h-1.5 w-1.5 rounded-full", partnerPresence ? "bg-blue-400 animate-pulse" : "bg-zinc-700")}></div>
                            {partnerPresence ? "Partner Online" : "Partner Offline"}
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-500">
                    <div className="flex items-center gap-1.5">
                        <Cpu className={cn("h-3 w-3", engineStatus === 'ready' ? "text-green-500" : "text-yellow-500")} />
                        <span>Engine: {engineStatus === 'loading' ? 'Locating WASM Interpreter...' : engineStatus === 'ready' ? 'Pyodide 3.11 Ready' : 'Execution Error'}</span>
                    </div>
                    {lastEditedBy && (
                        <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3" />
                            <span>Last edited by <span className="text-zinc-300 font-medium">{lastEditedBy}</span></span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        <span>Real-time Sync Enabled</span>
                    </div>
                </div>
            </header>

            <div className="grid gap-6 lg:grid-cols-2 lg:h-[600px]">
                {/* Editor Section */}
                <Card className="border-zinc-800 bg-zinc-900/40 flex flex-col overflow-hidden">
                    <CardHeader className="py-3 px-4 border-b border-zinc-800 flex flex-row items-center justify-between bg-zinc-900/60">
                        <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500"></div>
                            <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <span className="ml-2 text-[10px] font-mono text-zinc-500">main.py</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-white" onClick={() => setCode('print("Hello Duo! 🚀")')}>
                            <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 relative">
                        <textarea
                            value={code}
                            onChange={handleCodeChange}
                            className="w-full h-full bg-transparent p-6 font-mono text-sm resize-none focus:outline-none text-zinc-300 leading-relaxed custom-scrollbar"
                            placeholder="# Write your Python code here..."
                            spellCheck={false}
                        />
                    </CardContent>
                    <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex justify-end">
                        <Button
                            onClick={runCode}
                            disabled={isRunning || engineStatus !== 'ready'}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold gap-2 px-6 shadow-lg shadow-green-900/20"
                        >
                            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                            {engineStatus === 'loading' ? 'Loading Engine...' : 'Run Code'}
                        </Button>
                    </div>
                </Card>

                {/* Output Section */}
                <Card className="border-zinc-800 bg-zinc-950 flex flex-col overflow-hidden shadow-2xl">
                    <CardHeader className="py-3 px-4 border-b border-zinc-800 bg-zinc-900/40">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2">
                            <Share2 className="h-3 w-3" />
                            Console Output
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 flex-1 font-mono text-sm overflow-y-auto custom-scrollbar">
                        {isRunning ? (
                            <div className="flex items-center gap-2 text-zinc-500 animate-pulse">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                <span>Executing via WASM...</span>
                            </div>
                        ) : output ? (
                            <pre className={cn(
                                "whitespace-pre-wrap break-all",
                                output.startsWith('Error') ? "text-red-400" : "text-green-400"
                            )}>
                                {output}
                            </pre>
                        ) : (
                            <span className="text-zinc-600 italic">No output yet. Click "Run Code" to see results.</span>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
