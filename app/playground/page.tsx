"use client"

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Play, Loader2, User, Clock, Terminal, RotateCcw, Share2, Cpu, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react'
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
    const [code, setCode] = useState('print("Hello Achu!")')
    const [output, setOutput] = useState('')
    const [isRunning, setIsRunning] = useState(false)
    const [isTyping, setIsTyping] = useState(false)
    const [lastEditedBy, setLastEditedBy] = useState<string | null>(null)
    const [presenceCount, setPresenceCount] = useState(0)
    const [pyodide, setPyodide] = useState<any>(null)
    const [engineStatus, setEngineStatus] = useState<'loading' | 'ready' | 'error'>('loading')
    const [showConsole, setShowConsole] = useState(false)

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const ignoreNextSyncRef = useRef(false)

    const [lineCount, setLineCount] = useState(1)

    // Sync line numbers and save to localStorage
    useEffect(() => {
        setLineCount(code.split('\n').length)
        if (code !== 'print("Hello Achu!")') {
            localStorage.setItem('playground-code', code)
        }
    }, [code])

    // Initial load from API and localStorage
    useEffect(() => {
        const fetchInitialCode = async () => {
            try {
                const res = await fetch('/api/playground')
                const data = await res.json()
                if (data && data.code) {
                    setCode(data.code)
                    if (data.lastEditedBy) setLastEditedBy(getUserName(data.lastEditedBy))
                    return
                }
            } catch (error) {
                console.error('Failed to fetch initial code', error)
            }

            // Fallback to localStorage if API fails
            const savedCode = localStorage.getItem('playground-code')
            if (savedCode) {
                setCode(savedCode)
            }
        }

        fetchInitialCode()
    }, [])

    // Load Pyodide
    const initPyodide = async () => {
        if (typeof window.loadPyodide === 'undefined' || pyodide) return;
        try {
            setEngineStatus('loading');
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
        // Check if Pyodide is already loaded (e.g. after refresh or navigation)
        if (typeof window.loadPyodide !== 'undefined' && !pyodide) {
            initPyodide();
        }
    }, [pyodide]);

    useEffect(() => {
        if (!currentId) return

        // Presence Channel for reliable status
        const presenceChannel = pusherClient.subscribe('presence-playground')

        presenceChannel.bind('pusher:subscription_succeeded', (members: any) => {
            setPresenceCount(members.count)
        })

        presenceChannel.bind('pusher:member_added', () => {
            setPresenceCount(prev => prev + 1)
        })

        presenceChannel.bind('pusher:member_removed', () => {
            setPresenceCount(prev => Math.max(0, prev - 1))
        })

        // Collaboration Channel
        const channel = pusherClient.subscribe('playground')

        channel.bind('code-update', (data: any) => {
            if (data.senderId !== currentId) {
                if (data.type === 'sync') {
                    ignoreNextSyncRef.current = true
                    setCode(data.code)
                    localStorage.setItem('playground-code', data.code)
                    setLastEditedBy(data.senderName)
                } else if (data.type === 'typing') {
                    setIsTyping(true)
                    setTimeout(() => setIsTyping(false), 2000)
                }
            }
        })

        return () => {
            pusherClient.unsubscribe('presence-playground')
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

        fetch('/api/playground/sync', {
            method: 'POST',
            body: JSON.stringify({ type: 'typing', senderId: currentId })
        })

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
        typingTimeoutRef.current = setTimeout(() => {
            syncCode(newCode)
        }, 800)
    }

    const runCode = async () => {
        if (!pyodide) return;
        setIsRunning(true)
        setOutput('')
        setShowConsole(true)

        try {
            await pyodide.runPython(`
                import sys
                import io
                sys.stdout = io.StringIO()
                sys.stderr = io.StringIO()
            `);

            await pyodide.runPythonAsync(code);

            const stdout = await pyodide.runPython("sys.stdout.getvalue()");
            const stderr = await pyodide.runPython("sys.stderr.getvalue()");

            const result = stdout + (stderr ? `\nError:\n${stderr}` : '');
            setOutput(result || 'Code executed with no output.');
        } catch (error: any) {
            setOutput(`Error: ${error.message}`);
        } finally {
            setIsRunning(false)
        }
    }

    return (
        <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[750px] space-y-4 max-w-7xl mx-auto px-1 md:px-0">
            <Script
                src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"
                onLoad={initPyodide}
            />

            {/* Header Area */}
            <header className="flex flex-col gap-2 shrink-0 px-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <Terminal className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white leading-none">Pyground</h1>
                            <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-widest font-bold">VS Code Edition</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {isTyping && (
                            <span className="text-[10px] text-blue-400 animate-pulse font-bold bg-blue-500/5 px-2 py-0.5 rounded-full border border-blue-500/10 hidden sm:inline">
                                Partner typing...
                            </span>
                        )}
                        <div className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all duration-500 shadow-lg",
                            presenceCount > 1 ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                        )}>
                            <div className={cn("h-1.5 w-1.5 rounded-full", presenceCount > 1 ? "bg-green-400 animate-pulse" : "bg-zinc-700")}></div>
                            {presenceCount > 1 ? "Partner Online" : "Partner Offline"}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Interactive Editor */}
            <Card className="flex-1 flex flex-col bg-[#1e1e1e] border-zinc-800 overflow-hidden shadow-2xl relative">

                {/* Editor Toolbar */}
                <div className="h-10 flex items-center justify-between px-4 bg-[#252526] border-b border-[#1a1a1a] shrink-0">
                    <div className="flex items-center gap-4 text-[11px] font-medium text-zinc-400">
                        <div className="flex items-center gap-1.5 text-blue-400 border-b-2 border-blue-500 h-10 px-2 mt-[2px]">
                            <Terminal className="h-3 w-3" />
                            main.py
                        </div>
                        {lastEditedBy && (
                            <div className="hidden sm:flex items-center gap-1.5 border-l border-zinc-800 pl-4">
                                <User className="h-3 w-3" />
                                <span>Recent edits by <span className="text-zinc-200">{lastEditedBy}</span></span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-900/50 rounded text-[10px] text-zinc-500 mr-2">
                            <Cpu className={cn("h-3 w-3", engineStatus === 'ready' ? "text-green-500" : "text-zinc-600")} />
                            <span>{engineStatus === 'ready' ? 'Python 3.11' : 'Initializing...'}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-400 hover:text-white" onClick={() => {
                            if (confirm('Reset current code?')) setCode('print("Hello Achu!")')
                        }}>
                            <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Editor Content with Line Numbers */}
                <div className="flex-1 flex overflow-hidden relative group">
                    {/* Line Numbers */}
                    <div className="w-10 bg-[#1e1e1e] flex flex-col items-center pt-5 text-[12px] font-mono text-[#858585] select-none border-r border-[#2d2d2d]">
                        {Array.from({ length: lineCount }).map((_, i) => (
                            <div key={i} className="h-[21px] leading-[21px]">{i + 1}</div>
                        ))}
                    </div>

                    {/* Textarea */}
                    <textarea
                        ref={textareaRef}
                        value={code}
                        onChange={handleCodeChange}
                        className="flex-1 bg-transparent p-5 font-mono text-[14px] resize-none focus:outline-none text-[#d4d4d4] leading-[21px] custom-scrollbar overflow-x-auto whitespace-pre z-10"
                        placeholder="# Write your Python code here..."
                        spellCheck={false}
                    />

                    {/* Floating Run Button for Mobile/Desktop */}
                    <div className="absolute bottom-6 right-6 z-20">
                        <Button
                            onClick={runCode}
                            disabled={isRunning || engineStatus !== 'ready'}
                            className="h-12 w-12 md:h-auto md:w-auto md:px-6 rounded-full md:rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-2xl shadow-blue-500/20 active:scale-95 transition-all"
                        >
                            {isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5 fill-current" />}
                            <span className="hidden md:inline">Run Code</span>
                        </Button>
                    </div>
                </div>

                {/* Dynamic Sliding Console */}
                <div className={cn(
                    "absolute bottom-6 md:bottom-6 left-0 right-0 bg-[#181818] border-t border-[#333333] transition-all duration-300 ease-in-out z-30 flex flex-col",
                    showConsole ? "h-1/3 md:h-[250px]" : "h-0"
                )}>
                    <div className="h-8 shrink-0 flex items-center justify-between px-4 bg-[#252526] border-b border-[#1a1a1a]">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                            <Share2 className="h-3 w-3" />
                            Output Console
                        </span>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-zinc-500 hover:text-white"
                                onClick={() => setShowConsole(!showConsole)}
                            >
                                {showConsole ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 p-4 font-mono text-sm overflow-y-auto custom-scrollbar-thin bg-[#0f0f0f]">
                        {output ? (
                            <pre className={cn(
                                "whitespace-pre-wrap break-all",
                                output.startsWith('Error') ? "text-red-400" : "text-[#4ec9b0]"
                            )}>
                                {output}
                            </pre>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-2 opacity-50">
                                <CheckCircle2 className="h-8 w-8" />
                                <span className="text-xs">No output to display</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Status Bar - Integrated into Card */}
                <footer className="h-6 bg-[#007acc] px-3 flex items-center justify-between text-[9px] md:text-[10px] text-white font-medium shrink-0 z-40">
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="flex items-center gap-1 hover:bg-white/10 px-1 cursor-default">
                            <Share2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            <span className="hidden xs:inline">main*</span>
                            <span className="xs:hidden">m*</span>
                        </div>
                        <div className="flex items-center gap-1 hover:bg-white/10 px-1">
                            <RotateCcw className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            0 Errors
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <span className="hidden md:inline">UTF-8</span>
                        <span>Python 3.11</span>
                        <div className="flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            <span className="hidden sm:inline">Prettier</span>
                        </div>
                    </div>
                </footer>
            </Card>
        </div>
    )
}
