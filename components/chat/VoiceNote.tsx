"use client"

import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatClock } from '@/lib/voice'
import type { ChatAudio } from '@/lib/types'

// Only one voice message plays at a time (like WhatsApp)
let playing: HTMLAudioElement | null = null
const SPEEDS = [1, 1.5, 2]

export function VoiceNote({ audio, mine, meta, disabled }: { audio: ChatAudio; mine: boolean; meta: React.ReactNode; disabled?: boolean }) {
    const ref = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [progress, setProgress] = useState(0) // 0–1
    const [elapsed, setElapsed] = useState(0)
    const [speed, setSpeed] = useState(1)
    const [duration, setDuration] = useState(audio.durationMs)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onTime = () => {
            const d = isFinite(el.duration) && el.duration > 0 ? el.duration * 1000 : audio.durationMs
            setElapsed(el.currentTime * 1000)
            setProgress(d ? Math.min(1, (el.currentTime * 1000) / d) : 0)
        }
        const onMeta = () => isFinite(el.duration) && el.duration > 0 && setDuration(el.duration * 1000)
        const onEnd = () => {
            setIsPlaying(false)
            setProgress(0)
            setElapsed(0)
        }
        const onPause = () => setIsPlaying(false)
        const onPlay = () => setIsPlaying(true)
        el.addEventListener('timeupdate', onTime)
        el.addEventListener('loadedmetadata', onMeta)
        el.addEventListener('ended', onEnd)
        el.addEventListener('pause', onPause)
        el.addEventListener('play', onPlay)
        return () => {
            el.removeEventListener('timeupdate', onTime)
            el.removeEventListener('loadedmetadata', onMeta)
            el.removeEventListener('ended', onEnd)
            el.removeEventListener('pause', onPause)
            el.removeEventListener('play', onPlay)
        }
    }, [audio.durationMs])

    const toggle = (e: React.MouseEvent) => {
        e.stopPropagation()
        const el = ref.current
        if (!el || disabled) return
        if (el.paused) {
            if (playing && playing !== el) playing.pause()
            playing = el
            el.playbackRate = speed
            el.play().catch(() => setIsPlaying(false))
        } else {
            el.pause()
        }
    }

    const seek = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation()
        const el = ref.current
        if (!el || disabled) return
        const r = e.currentTarget.getBoundingClientRect()
        const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
        const d = isFinite(el.duration) && el.duration > 0 ? el.duration : duration / 1000
        el.currentTime = frac * d
        setProgress(frac)
    }

    const cycleSpeed = (e: React.MouseEvent) => {
        e.stopPropagation()
        const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]
        setSpeed(next)
        if (ref.current) ref.current.playbackRate = next
    }

    const bars = audio.waveform.length ? audio.waveform : Array(48).fill(20)

    return (
        <div className="flex w-[250px] max-w-full items-center gap-2.5 py-0.5">
            <audio ref={ref} src={audio.url} preload="metadata" />
            <button
                onClick={toggle}
                aria-label={isPlaying ? 'Pause' : 'Play voice message'}
                className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', mine ? 'bg-white text-accent' : 'bg-accent text-white')}
            >
                {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
            </button>
            <div className="min-w-0 flex-1">
                <div className="flex h-7 cursor-pointer items-center gap-[1.5px] overflow-hidden" onClick={seek}>
                    {bars.map((v, i) => (
                        <span
                            key={i}
                            className={cn(
                                'min-w-0 max-w-[3px] flex-1 rounded-full',
                                i / bars.length < progress ? (mine ? 'bg-white' : 'bg-accent') : mine ? 'bg-white/45' : 'bg-white/30',
                            )}
                            style={{ height: `${Math.max(12, v)}%` }}
                        />
                    ))}
                </div>
                <div className="mt-0.5 flex items-center justify-between gap-2 text-[11px] leading-none">
                    <span className={mine ? 'text-white/75' : 'text-muted'}>
                        {formatClock(isPlaying || elapsed ? elapsed : duration)}
                        {(isPlaying || speed !== 1) && (
                            <button onClick={cycleSpeed} className="ml-2 rounded-full bg-black/20 px-1.5 py-0.5 font-semibold">
                                {speed}×
                            </button>
                        )}
                    </span>
                    {meta}
                </div>
            </div>
        </div>
    )
}
