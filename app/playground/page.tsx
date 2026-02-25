"use client"

import { useState, useEffect, useRef, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Play, Loader2, User, Clock, Terminal, RotateCcw, Share2, Cpu, ChevronUp, ChevronDown, CheckCircle2, Copy, Search, ArrowDown } from 'lucide-react'
import { useIdentity } from '@/lib/identity'
import { getUserName } from '@/lib/constants'
import { pusherClient } from '@/lib/pusher'
import { cn } from '@/lib/utils'
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())
import Script from 'next/script'

declare global {
    interface Window {
        loadPyodide: any;
    }
}

// Bracket pairs
const BRACKET_PAIRS: Record<string, string> = {
    '(': ')', '[': ']', '{': '}', '"': '"', "'": "'"
}
const CLOSE_BRACKETS = new Set(Object.values(BRACKET_PAIRS))

// Python keywords that trigger auto-indent
const INDENT_TRIGGERS = ['if', 'elif', 'else', 'for', 'while', 'def', 'class', 'with', 'try', 'except', 'finally']

export default function PlaygroundPage() {
    const { currentId } = useIdentity()
    const [code, setCode] = useState('print("Hello Achu!")')
    const { data: serverState } = useSWR('/api/playground', fetcher, {
        revalidateOnFocus: true,
        revalidateOnMount: true,
        dedupingInterval: 2000,
    })
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
    const highlightsRef = useRef<HTMLPreElement>(null)

    const [lineCount, setLineCount] = useState(1)
    const [suggestions, setSuggestions] = useState<string[]>([])
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 })
    const [showSuggestions, setShowSuggestions] = useState(false)

    // VS Code features state
    const [cursorLine, setCursorLine] = useState(1)
    const [cursorCol, setCursorCol] = useState(1)
    const [activeLine, setActiveLine] = useState(1)
    const [executionTime, setExecutionTime] = useState<number | null>(null)
    const [errorCount, setErrorCount] = useState(0)

    const PYTHON_KEYWORDS = [
        'print', 'len', 'range', 'input', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple',
        'if', 'else', 'elif', 'for', 'while', 'break', 'continue', 'return', 'def', 'class',
        'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'lambda', 'True', 'False', 'None',
        'append', 'extend', 'insert', 'remove', 'pop', 'clear', 'index', 'count', 'sort', 'reverse',
        'keys', 'values', 'items', 'get', 'update', 'split', 'join', 'strip', 'lower', 'upper', 'replace',
        'enumerate', 'zip', 'map', 'filter', 'sorted', 'abs', 'max', 'min', 'sum', 'type', 'isinstance',
        'open', 'read', 'write', 'close', 'readline', 'readlines', 'format', 'round', 'chr', 'ord',
        'hex', 'bin', 'oct', 'bool', 'bytes', 'bytearray', 'complex', 'frozenset', 'object', 'property',
        'staticmethod', 'classmethod', 'super', 'hasattr', 'getattr', 'setattr', 'delattr', 'callable',
        'iter', 'next', 'reversed', 'all', 'any', 'dir', 'id', 'hash', 'help', 'vars', 'globals', 'locals'
    ]

    // Categorize for Intellisense icons
    const KEYWORD_SET = new Set(['if', 'else', 'elif', 'for', 'while', 'break', 'continue', 'return', 'def', 'class', 'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'lambda', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'pass', 'raise', 'yield', 'del', 'global', 'nonlocal', 'assert'])
    const METHOD_SET = new Set(['append', 'extend', 'insert', 'remove', 'pop', 'clear', 'index', 'count', 'sort', 'reverse', 'keys', 'values', 'items', 'get', 'update', 'split', 'join', 'strip', 'lower', 'upper', 'replace', 'read', 'write', 'close', 'readline', 'readlines', 'format'])

    const getIntellisenseIcon = (word: string) => {
        if (KEYWORD_SET.has(word)) return { letter: 'K', color: 'text-purple-400', bg: 'bg-purple-500/20' }
        if (METHOD_SET.has(word)) return { letter: 'M', color: 'text-orange-400', bg: 'bg-orange-500/20' }
        return { letter: 'F', color: 'text-blue-400', bg: 'bg-blue-500/20' }
    }

    // Sync line numbers and save to localStorage
    useEffect(() => {
        setLineCount(code.split('\n').length)
        if (code !== 'print("Hello Achu!")') {
            localStorage.setItem('playground-code', code)
        }
    }, [code])

    // Load cached code from localStorage on first mount
    useEffect(() => {
        const savedCode = localStorage.getItem('playground-code')
        const savedLastEditedBy = localStorage.getItem('playground-last-edited')

        if (savedCode) {
            setCode(savedCode)
            setLineCount(savedCode.split('\n').length)
        }
        if (savedLastEditedBy) setLastEditedBy(savedLastEditedBy)
    }, [])

    // Sync from server whenever SWR revalidates (on mount, focus, navigation)
    useEffect(() => {
        if (serverState && serverState.code) {
            setCode(serverState.code)
            setLineCount(serverState.code.split('\n').length)
            if (serverState.lastEditedBy) {
                const name = getUserName(serverState.lastEditedBy)
                setLastEditedBy(name)
                localStorage.setItem('playground-last-edited', name)
            }
            localStorage.setItem('playground-code', serverState.code)
        }
    }, [serverState])

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
        if (typeof window.loadPyodide !== 'undefined' && !pyodide) {
            initPyodide();
        }
    }, [pyodide]);

    useEffect(() => {
        if (!currentId) return

        const presenceChannel = pusherClient.subscribe('presence-playground')
        presenceChannel.bind('pusher:subscription_succeeded', (members: any) => setPresenceCount(members.count))
        presenceChannel.bind('pusher:member_added', () => setPresenceCount(prev => prev + 1))
        presenceChannel.bind('pusher:member_removed', () => setPresenceCount(prev => Math.max(0, prev - 1)))

        const channel = pusherClient.subscribe('playground')
        channel.bind('code-update', (data: any) => {
            if (data.senderId !== currentId) {
                if (data.type === 'sync') {
                    ignoreNextSyncRef.current = true
                    setCode(data.code)
                    setLineCount(data.code.split('\n').length)
                    localStorage.setItem('playground-code', data.code)
                    setLastEditedBy(data.senderName)
                    localStorage.setItem('playground-last-edited', data.senderName)
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

    // Update cursor position on click and key events
    const updateCursorPosition = useCallback(() => {
        if (!textareaRef.current) return
        const pos = textareaRef.current.selectionStart
        const textBefore = code.substring(0, pos)
        const lines = textBefore.split('\n')
        const ln = lines.length
        const col = lines[lines.length - 1].length + 1
        setCursorLine(ln)
        setCursorCol(col)
        setActiveLine(ln)
    }, [code])

    const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newCode = e.target.value
        setCode(newCode)
        updateCursorPosition()

        // Basic Intellisense trigger
        const cursor = e.target.selectionStart
        const textBeforeCursor = newCode.substring(0, cursor)
        const currentWordMatch = textBeforeCursor.match(/(\b[a-zA-Z_][a-zA-Z0-9_]*)$/)

        if (currentWordMatch && currentWordMatch[1].length >= 2) {
            const currentWord = currentWordMatch[1]
            const filtered = PYTHON_KEYWORDS.filter(k => k.startsWith(currentWord) && k !== currentWord).slice(0, 8)
            if (filtered.length > 0) {
                setSuggestions(filtered)
                setSelectedIndex(0)
                setShowSuggestions(true)

                const lines = textBeforeCursor.split('\n')
                const currentLine = lines.length
                const charInLine = lines[lines.length - 1].length
                setSuggestionPos({
                    top: (currentLine * 21) + 20,
                    left: (charInLine * 8.4) + 10
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

            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = newBefore.length
                    textareaRef.current.focus()
                }
            }, 0)
        }
    }

    const highlightCode = (code: string) => {
        if (!code) return "";

        let escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        const patterns = [
            { name: 'comment', regex: /#.*$/gm, color: '#6a9955' },
            { name: 'string', regex: /(["'])(?:(?=(\\?))\2.)*?\1/g, color: '#ce9178' },
            { name: 'keyword', regex: /\b(and|as|assert|break|class|continue|def|del|elif|else|except|False|finally|for|from|global|if|import|in|is|lambda|None|nonlocal|not|or|pass|raise|return|True|try|while|with|yield|print)\b/g, color: '#569cd6' },
            { name: 'function', regex: /\b([a-zA-Z_][a-zA-Z0-9_]*)(?=\()/g, color: '#dcdcaa' },
            { name: 'number', regex: /\b\d+\.?\d*\b/g, color: '#b5cea8' },
            { name: 'decorator', regex: /^@\w+/gm, color: '#dcdcaa' }
        ];

        const combinedRegex = new RegExp(
            patterns.map(p => `(${p.regex.source})`).join('|'),
            'gm'
        );

        return escaped.replace(combinedRegex, (match, ...args) => {
            const groups = args.slice(0, patterns.length);
            const index = groups.findIndex(g => g !== undefined);
            if (index !== -1) {
                return `<span style="color: ${patterns[index].color}">${match}</span>`;
            }
            return match;
        });
    }

    // Helper to set code and cursor position
    const setCodeWithCursor = (newCode: string, cursorPos: number) => {
        setCode(newCode)
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.selectionStart = textareaRef.current.selectionEnd = cursorPos
                textareaRef.current.focus()
            }
        }, 0)
    }

    // Get current line's leading whitespace
    const getLineIndent = (lineText: string) => {
        const match = lineText.match(/^(\s*)/)
        return match ? match[1] : ''
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const ta = e.currentTarget
        const start = ta.selectionStart
        const end = ta.selectionEnd

        // Intellisense navigation
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

        // Ctrl+Enter → Run Code
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            runCode()
            return
        }

        // Ctrl+S → Force Sync
        if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            syncCode(code)
            return
        }

        // Ctrl+D → Duplicate Line
        if (e.key === 'd' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            const lines = code.split('\n')
            const textBefore = code.substring(0, start)
            const currentLineIdx = textBefore.split('\n').length - 1
            const currentLine = lines[currentLineIdx]
            lines.splice(currentLineIdx + 1, 0, currentLine)
            const newCode = lines.join('\n')
            const newCursor = start + currentLine.length + 1
            setCodeWithCursor(newCode, newCursor)
            return
        }

        // Ctrl+/ → Toggle Comment
        if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            const lines = code.split('\n')
            const textBefore = code.substring(0, start)
            const currentLineIdx = textBefore.split('\n').length - 1
            const line = lines[currentLineIdx]

            if (line.trimStart().startsWith('# ')) {
                // Remove comment
                const idx = line.indexOf('# ')
                lines[currentLineIdx] = line.substring(0, idx) + line.substring(idx + 2)
                const newCode = lines.join('\n')
                setCodeWithCursor(newCode, Math.max(0, start - 2))
            } else {
                // Add comment
                const indent = getLineIndent(line)
                lines[currentLineIdx] = indent + '# ' + line.trimStart()
                const newCode = lines.join('\n')
                setCodeWithCursor(newCode, start + 2)
            }
            return
        }

        // Enter → Auto-indent
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            const textBefore = code.substring(0, start)
            const textAfter = code.substring(end)
            const lines = textBefore.split('\n')
            const currentLine = lines[lines.length - 1]
            const currentIndent = getLineIndent(currentLine)

            // Check if line ends with : (auto-indent trigger)
            const trimmed = currentLine.trimEnd()
            let newIndent = currentIndent
            if (trimmed.endsWith(':')) {
                newIndent = currentIndent + '    '
            }

            const newCode = textBefore + '\n' + newIndent + textAfter
            const newCursor = start + 1 + newIndent.length
            setCodeWithCursor(newCode, newCursor)
            return
        }

        // Tab → Insert 4 spaces
        if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault()
            const newCode = code.substring(0, start) + '    ' + code.substring(end)
            setCodeWithCursor(newCode, start + 4)
            return
        }

        // Shift+Tab → Remove 4 spaces
        if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault()
            const textBefore = code.substring(0, start)
            const lines = textBefore.split('\n')
            const currentLine = lines[lines.length - 1]
            if (currentLine.startsWith('    ')) {
                const allLines = code.split('\n')
                const lineIdx = lines.length - 1
                allLines[lineIdx] = allLines[lineIdx].substring(4)
                setCodeWithCursor(allLines.join('\n'), Math.max(0, start - 4))
            }
            return
        }

        // Bracket auto-close
        if (BRACKET_PAIRS[e.key]) {
            const closingBracket = BRACKET_PAIRS[e.key]

            // For quotes, only auto-close if not inside a string already
            if ((e.key === '"' || e.key === "'") && start > 0) {
                const charBefore = code[start - 1]
                // If the same quote is right after cursor, just skip over it
                if (code[start] === e.key) {
                    e.preventDefault()
                    if (textareaRef.current) {
                        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1
                    }
                    return
                }
                // Don't auto-close if previous char is alphanumeric (e.g., don't in contractions)
                if (/[a-zA-Z0-9]/.test(charBefore)) return
            }

            e.preventDefault()
            const selectedText = code.substring(start, end)
            if (selectedText) {
                // Wrap selection
                const newCode = code.substring(0, start) + e.key + selectedText + closingBracket + code.substring(end)
                setCodeWithCursor(newCode, start + 1 + selectedText.length)
            } else {
                const newCode = code.substring(0, start) + e.key + closingBracket + code.substring(end)
                setCodeWithCursor(newCode, start + 1)
            }
            return
        }

        // Skip closing bracket if next char matches
        if (CLOSE_BRACKETS.has(e.key) && code[start] === e.key) {
            e.preventDefault()
            if (textareaRef.current) {
                textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 1
            }
            return
        }

        // Backspace deletes matching pair
        if (e.key === 'Backspace' && start === end && start > 0) {
            const charBefore = code[start - 1]
            const charAfter = code[start]
            if (BRACKET_PAIRS[charBefore] && BRACKET_PAIRS[charBefore] === charAfter) {
                e.preventDefault()
                const newCode = code.substring(0, start - 1) + code.substring(start + 1)
                setCodeWithCursor(newCode, start - 1)
                return
            }
        }
    };

    const runCode = async () => {
        if (!pyodide) return;
        setIsRunning(true)
        setOutput('')
        setShowConsole(true)
        setErrorCount(0)
        const startTime = performance.now()

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
            if (stderr) setErrorCount(1)
        } catch (error: any) {
            setOutput(`Error: ${error.message}`);
            setErrorCount(1)
        } finally {
            const endTime = performance.now()
            setExecutionTime(Math.round(endTime - startTime))
            setIsRunning(false)
        }
    }

    const handleCopyCode = () => {
        navigator.clipboard.writeText(code)
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
                            <span>{engineStatus === 'ready' ? 'Python 3.11' : 'Init...'}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7 text-zinc-400 hover:text-white" onClick={handleCopyCode} title="Copy Code">
                            <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 md:h-7 md:w-7 text-zinc-400 hover:text-white" onClick={() => {
                            if (confirm('Reset current code?')) setCode('print("Hello Achu!")')
                        }} title="Reset Code">
                            <RotateCcw className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* Editor Content with Line Numbers */}
                <div className="flex-1 flex overflow-hidden relative group">
                    {/* Line Numbers */}
                    <div className="w-8 md:w-12 bg-[#1e1e1e] flex flex-col items-end pr-2 md:pr-3 pt-4 md:pt-5 text-[11px] md:text-[12px] font-mono text-[#858585] select-none border-r border-[#2d2d2d] shrink-0">
                        {Array.from({ length: lineCount }).map((_, i) => (
                            <div key={i} className={cn(
                                "h-[21px] leading-[21px] w-full text-right pr-1 transition-colors",
                                activeLine === i + 1 ? "text-[#c6c6c6]" : ""
                            )}>{i + 1}</div>
                        ))}
                    </div>

                    {/* Editor Container */}
                    <div className="flex-1 relative overflow-hidden">
                        {/* Active Line Highlight */}
                        <div
                            className="absolute left-0 right-0 h-[21px] bg-[#2a2d2e] pointer-events-none transition-all z-[1]"
                            style={{ top: `${(activeLine - 1) * 21 + (typeof window !== 'undefined' && window.innerWidth < 768 ? 16 : 20)}px` }}
                        />

                        {/* Highlights Layer */}
                        <pre
                            ref={highlightsRef}
                            className="absolute inset-0 p-4 md:p-5 pointer-events-none whitespace-pre-wrap leading-[21px] text-[#808080] overflow-hidden font-mono text-[13px] md:text-[14px] z-[2]"
                            dangerouslySetInnerHTML={{ __html: highlightCode(code) + '\n' }}
                            style={{
                                fontVariantLigatures: 'none',
                                MozTabSize: 4,
                                OTabSize: 4,
                                tabSize: 4,
                                fontWeight: 400,
                                letterSpacing: '0px'
                            }}
                        />

                        {/* Textarea Layer */}
                        <textarea
                            ref={textareaRef}
                            value={code}
                            onChange={handleCodeChange}
                            onKeyDown={handleKeyDown}
                            onScroll={handleScroll}
                            onClick={updateCursorPosition}
                            onKeyUp={updateCursorPosition}
                            className="absolute inset-0 w-full h-full bg-transparent p-4 md:p-5 resize-none focus:outline-none text-transparent caret-white leading-[21px] custom-scrollbar z-10 whitespace-pre-wrap font-mono text-[13px] md:text-[14px]"
                            placeholder="# Write your Python code here..."
                            spellCheck={false}
                            autoCapitalize="off"
                            autoComplete="off"
                            autoCorrect="off"
                            style={{
                                fontVariantLigatures: 'none',
                                MozTabSize: 4,
                                OTabSize: 4,
                                tabSize: 4,
                                fontWeight: 400,
                                letterSpacing: '0px'
                            }}
                        />

                        {/* Intellisense Widget */}
                        {showSuggestions && (
                            <div
                                className="absolute z-50 bg-[#252526] border border-[#454545] rounded-md shadow-2xl min-w-[200px] max-h-[200px] overflow-y-auto pointer-events-auto"
                                style={{
                                    top: Math.min(suggestionPos.top, (textareaRef.current?.clientHeight || 0) - 100),
                                    left: Math.min(suggestionPos.left, (textareaRef.current?.clientWidth || 0) - 210)
                                }}
                            >
                                {suggestions.map((s, i) => {
                                    const icon = getIntellisenseIcon(s)
                                    return (
                                        <div
                                            key={s}
                                            onClick={() => selectSuggestion(s)}
                                            className={cn(
                                                "px-3 py-1.5 text-[11px] md:text-[12px] cursor-pointer flex items-center gap-2.5 transition-colors font-mono",
                                                i === selectedIndex ? "bg-[#094771] text-white" : "text-zinc-400 hover:bg-[#2a2d2e]"
                                            )}
                                        >
                                            <div className={cn("w-4 h-4 rounded flex items-center justify-center shrink-0", icon.bg)}>
                                                <span className={cn("text-[9px] font-bold", icon.color)}>{icon.letter}</span>
                                            </div>
                                            {s}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Floating Run Button */}
                    <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6 z-20">
                        <Button
                            onClick={runCode}
                            disabled={isRunning || engineStatus !== 'ready'}
                            className="h-10 w-10 md:h-auto md:w-auto md:px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-2xl shadow-blue-500/30 active:scale-95 transition-all"
                            title="Run Code (Ctrl+Enter)"
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
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                                <Terminal className="h-2.5 w-2.5 md:h-3 md:w-3" />
                                Output Console
                            </span>
                            {executionTime !== null && (
                                <span className="text-[9px] text-zinc-600 flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5" />
                                    {executionTime}ms
                                </span>
                            )}
                        </div>
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

                {/* VS Code Status Bar */}
                <footer className="h-6 bg-[#007acc] px-2 md:px-3 flex items-center justify-between text-[8px] md:text-[10px] text-white font-medium shrink-0 z-40">
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="flex items-center gap-1 hover:bg-white/10 px-1 cursor-default">
                            <Share2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            <span className="hidden xs:inline">main*</span>
                            <span className="xs:hidden">m*</span>
                        </div>
                        <div className={cn(
                            "flex items-center gap-1 hover:bg-white/10 px-1",
                            errorCount > 0 ? "text-yellow-200" : ""
                        )}>
                            <RotateCcw className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            <span>{errorCount} {errorCount === 1 ? 'Error' : 'Errors'}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <span className="hover:bg-white/10 px-1 cursor-default">Ln {cursorLine}, Col {cursorCol}</span>
                        <span className="hidden md:inline hover:bg-white/10 px-1">Spaces: 4</span>
                        <span className="hidden md:inline hover:bg-white/10 px-1">UTF-8</span>
                        <span className="hover:bg-white/10 px-1">Python</span>
                        {executionTime !== null && (
                            <span className="hover:bg-white/10 px-1 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {executionTime}ms
                            </span>
                        )}
                        <div className="flex items-center gap-1 hover:bg-white/10 px-1">
                            <CheckCircle2 className="h-2.5 w-2.5 md:h-3 md:w-3" />
                            <span className="hidden sm:inline">Prettier</span>
                        </div>
                    </div>
                </footer>
            </Card>
        </div>
    )
}
