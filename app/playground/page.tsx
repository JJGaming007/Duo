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
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 })
    const [showSuggestions, setShowSuggestions] = useState(false)

    const highlightsRef = useRef<HTMLPreElement>(null)
    const PYTHON_KEYWORDS = [
        'print', 'len', 'range', 'input', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple',
        'if', 'else', 'elif', 'for', 'while', 'break', 'continue', 'return', 'def', 'class',
        'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'lambda', 'True', 'False', 'None',
        'append', 'extend', 'insert', 'remove', 'pop', 'clear', 'index', 'count', 'sort', 'reverse',
        'keys', 'values', 'items', 'get', 'update', 'split', 'join', 'strip', 'lower', 'upper', 'replace'
    ]

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

        // Basic Intellisense trigger
        const cursor = e.target.selectionStart
        const textBeforeCursor = newCode.substring(0, cursor)
        const currentWordMatch = textBeforeCursor.match(/(\b[a-zA-Z_][a-zA-Z0-9_]*)$/)

        if (currentWordMatch) {
            const currentWord = currentWordMatch[1]
            const filtered = PYTHON_KEYWORDS.filter(k => k.startsWith(currentWord) && k !== currentWord)
            if (filtered.length > 0) {
                setSuggestions(filtered)
                setSelectedIndex(0)
                setShowSuggestions(true)

                // Approximate position math (simplified)
                const lines = textBeforeCursor.split('\n')
                const currentLine = lines.length
                const charInLine = lines[lines.length - 1].length
                setSuggestionPos({
                    top: (currentLine * 21) + 20, // 21 is line height, 20 is padding
                    left: (charInLine * 8.4) + 40 // 8.4 is approx char width, 40 is line number bar
                })
            } else {
                setShowSuggestions(false)
            }
        } else {
            setShowSuggestions(false)
        }

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

    const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
        if (highlightsRef.current) {
            highlightsRef.current.scrollTop = e.currentTarget.scrollTop
            highlightsRef.current.scrollLeft = e.currentTarget.scrollLeft
        }
    }

    const selectSuggestion = (suggestion: string) => {
        if (!textareaRef.current) return
        const cursor = textareaRef.current.selectionStart
        const textBeforeCursor = code.substring(0, cursor)
        const textAfterCursor = code.substring(cursor)
        const lastWordMatch = textBeforeCursor.match(/(\b[a-zA-Z_][a-zA-Z0-9_]*)$/)

        if (lastWordMatch) {
            const lastWord = lastWordMatch[1]
            const newBefore = textBeforeCursor.substring(0, textBeforeCursor.length - lastWord.length) + suggestion
            const newCode = newBefore + textAfterCursor
            setCode(newCode)
            setShowSuggestions(false)

            // Set cursor position after completion
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newBefore.length
                    textareaRef.current.focus()
                }
            }, 0)
        }
    }

    const highlightCode = (code: string) => {
        // Simple but effective Python syntax highlighter
        let highlighted = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Keywords
        const keywords = ['and', 'as', 'assert', 'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try', 'while', 'with', 'yield', 'print'];
        highlighted = highlighted.replace(new RegExp(`\\b(${keywords.join('|')})\\b`, 'g'), '<span class="text-[#569cd6]">$1</span>');

        // Functions
        highlighted = highlighted.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g, '<span class="text-[#dcdcaa]">$1</span>');

        // Strings
        highlighted = highlighted.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, '<span class="text-[#ce9178]">$1</span>');

        // Comments
        highlighted = highlighted.replace(/#.*$/gm, '<span class="text-[#6a9955]">$0</span>');

        // Numbers
        highlighted = highlighted.replace(/\b\d+\b/g, '<span class="text-[#b5cea8]">$0</span>');

        return highlighted;
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showSuggestions) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIndex(prev => (prev + 1) % suggestions.length)
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
                return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                selectSuggestion(suggestions[selectedIndex])
                return
            }
            if (e.key === 'Escape') {
                setShowSuggestions(false)
                return
            }
        }

        if (e.key === 'Tab') {
            e.preventDefault();
            const start = e.currentTarget.selectionStart;
            const end = e.currentTarget.selectionEnd;
            const newCode = code.substring(0, start) + '    ' + code.substring(end);
            setCode(newCode);

            // Set cursor position after update
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
                }
            }, 0);
        }
    };

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
        <div className="flex flex-col h-[calc(100dvh-7.5rem)] md:h-[750px] p-2 md:p-6 space-y-3 md:space-y-4 max-w-7xl mx-auto overflow-hidden">
            <Script
                src="https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js"
                onLoad={initPyodide}
            />

            {/* Header Area */}
            <header className="flex flex-col gap-2 shrink-0 px-2 md:px-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg md:rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                            <Terminal className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-2xl font-bold tracking-tight text-white leading-none">Pyground</h1>
                            <p className="text-[9px] text-zinc-500 mt-0.5 uppercase tracking-widest font-bold">VS Code Edition</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3">
                        {isTyping && (
                            <span className="text-[9px] text-blue-400 animate-pulse font-bold bg-blue-500/5 px-2 py-0.5 rounded-full border border-blue-500/10 hidden sm:inline">
                                Partner typing...
                            </span>
                        )}
                        <div className={cn(
                            "flex items-center gap-1 px-2 md:px-3 py-1 md:py-1.5 rounded-full text-[9px] font-bold uppercase tracking-wider border transition-all duration-500 shadow-lg",
                            presenceCount > 1 ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                        )}>
                            <div className={cn("h-1 w-1 md:h-1.5 md:w-1.5 rounded-full", presenceCount > 1 ? "bg-green-400 animate-pulse" : "bg-zinc-700")}></div>
                            <span className="hidden xs:inline">{presenceCount > 1 ? "Partner Online" : "Partner Offline"}</span>
                            <span className="xs:hidden">{presenceCount > 1 ? "Online" : "Offline"}</span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Interactive Editor */}
            <Card className="flex-1 flex flex-col bg-[#1e1e1e] border-zinc-800 overflow-hidden shadow-2xl relative">

                {/* Editor Toolbar */}
                <div className="h-8 md:h-10 flex items-center justify-between px-3 md:px-4 bg-[#252526] border-b border-[#1a1a1a] shrink-0">
                    <div className="flex items-center gap-3 md:gap-4 text-[10px] md:text-[11px] font-medium text-zinc-400">
                        <div className="flex items-center gap-1 md:gap-1.5 text-blue-400 border-b-2 border-blue-500 h-8 md:h-10 px-1 md:px-2 mt-[2px]">
                            <Terminal className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            main.py
                        </div>
                        {lastEditedBy && (
                            <div className="hidden sm:flex items-center gap-1.5 border-l border-zinc-800 pl-4">
                                <User className="h-3 w-3" />
                                <span>Recent edits by <span className="text-zinc-200">{lastEditedBy}</span></span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1 md:gap-2">
                        <div className="flex items-center gap-1 md:gap-1.5 px-1.5 md:px-2 py-0.5 md:py-1 bg-zinc-900/50 rounded text-[9px] md:text-[10px] text-zinc-500 mr-1 md:mr-2">
                            <Cpu className={cn("h-2.5 w-2.5 md:h-3 md:w-3", engineStatus === 'ready' ? "text-green-500" : "text-zinc-600")} />
                            <span>{engineStatus === 'ready' ? (window.innerWidth < 640 ? 'Py 3.11' : 'Python 3.11') : 'Init...'}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7 text-zinc-400 hover:text-white" onClick={() => {
                            if (confirm('Reset current code?')) setCode('print("Hello Achu!")')
                        }}>
                            <RotateCcw className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Editor Content with Line Numbers */}
                <div className="flex-1 flex overflow-hidden relative group">
                    {/* Line Numbers */}
                    <div className="w-8 md:w-10 bg-[#1e1e1e] flex flex-col items-center pt-4 md:pt-5 text-[11px] md:text-[12px] font-mono text-[#858585] select-none border-r border-[#2d2d2d] shrink-0">
                        {Array.from({ length: lineCount }).map((_, i) => (
                            <div key={i} className="h-[21px] leading-[21px]">{i + 1}</div>
                        ))}
                    </div>

                    {/* Editor Container */}
                    <div className="flex-1 relative overflow-hidden font-mono text-[13px] md:text-[14px]">
                        {/* Highlights Layer - Must exactly match textarea font/padding */}
                        <pre
                            ref={highlightsRef}
                            className="absolute inset-0 p-4 md:p-5 pointer-events-none whitespace-pre-wrap break-all leading-[21px] text-transparent overflow-hidden font-mono"
                            dangerouslySetInnerHTML={{ __html: highlightCode(code) + '\n' }}
                            style={{
                                fontVariantLigatures: 'none',
                                MozTabSize: 4,
                                OTabSize: 4,
                                tabSize: 4,
                            }}
                        />

                        {/* Textarea Layer */}
                        <textarea
                            ref={textareaRef}
                            value={code}
                            onChange={handleCodeChange}
                            onKeyDown={handleKeyDown}
                            onScroll={handleScroll}
                            className="absolute inset-0 w-full h-full bg-transparent p-4 md:p-5 resize-none focus:outline-none text-[#d4d4d4] caret-white leading-[21px] custom-scrollbar z-10 whitespace-pre-wrap break-all font-mono"
                            placeholder="# Write your Python code here..."
                            spellCheck={false}
                            style={{
                                fontVariantLigatures: 'none',
                                MozTabSize: 4,
                                OTabSize: 4,
                                tabSize: 4,
                            }}
                        />

                        {/* Intellisense Widget */}
                        {showSuggestions && (
                            <div
                                className="absolute z-50 bg-[#252526] border border-[#454545] rounded shadow-2xl min-w-[160px] max-h-[200px] overflow-y-auto pointer-events-auto"
                                style={{
                                    top: Math.min(suggestionPos.top, (textareaRef.current?.clientHeight || 0) - 100),
                                    left: Math.min(suggestionPos.left, (textareaRef.current?.clientWidth || 0) - 170)
                                }}
                            >
                                {suggestions.map((s, i) => (
                                    <div
                                        key={s}
                                        onClick={() => selectSuggestion(s)}
                                        className={cn(
                                            "px-4 py-1.5 text-[11px] md:text-[12px] cursor-pointer flex items-center gap-2 transition-colors",
                                            i === selectedIndex ? "bg-[#094771] text-white" : "text-zinc-400 hover:bg-[#2a2d2e]"
                                        )}
                                    >
                                        <div className="w-3 h-3 bg-blue-500/20 rounded flex items-center justify-center">
                                            <span className="text-[8px] text-blue-400 font-bold">P</span>
                                        </div>
                                        {s}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Floating Run Button for Mobile/Desktop */}
                    <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20">
                        <Button
                            onClick={runCode}
                            disabled={isRunning || engineStatus !== 'ready'}
                            className="h-10 w-10 md:h-auto md:w-auto md:px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-2xl shadow-blue-500/30 active:scale-95 transition-all"
                        >
                            {isRunning ? <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin" /> : <Play className="h-4 w-4 md:h-5 md:w-5 fill-current" />}
                            <span className="hidden md:inline">Run Code</span>
                        </Button>
                    </div>
                </div>

                {/* Dynamic Sliding Console */}
                <div className={cn(
                    "absolute bottom-6 md:bottom-6 left-0 right-0 bg-[#181818] border-t border-[#333333] transition-all duration-300 ease-in-out z-30 flex flex-col",
                    showConsole ? "h-[45%] md:h-[250px]" : "h-0"
                )}>
                    <div className="h-8 shrink-0 flex items-center justify-between px-4 bg-[#252526] border-b border-[#1a1a1a]">
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                            <Share2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
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
                    <div className="flex-1 p-3 md:p-4 font-mono text-xs md:text-sm overflow-y-auto custom-scrollbar-thin bg-[#0f0f0f]">
                        {output ? (
                            <pre className={cn(
                                "whitespace-pre-wrap break-all",
                                output.startsWith('Error') ? "text-red-400" : "text-[#4ec9b0]"
                            )}>
                                {output}
                            </pre>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-700 space-y-2 opacity-50">
                                <CheckCircle2 className="h-6 w-6 md:h-8 md:w-8" />
                                <span className="text-[10px] md:text-xs">No output to display</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Status Bar - Integrated into Card */}
                <footer className="h-6 bg-[#007acc] px-2 md:px-3 flex items-center justify-between text-[8px] md:text-[10px] text-white font-medium shrink-0 z-40">
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="flex items-center gap-1 hover:bg-white/10 px-1 cursor-default">
                            <Share2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            <span className="hidden xs:inline">main*</span>
                            <span className="xs:hidden">m*</span>
                        </div>
                        <div className="flex items-center gap-1 hover:bg-white/10 px-1">
                            <RotateCcw className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            <span className="hidden xs:inline">0 Errors</span>
                            <span className="xs:hidden">0 Err</span>
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


