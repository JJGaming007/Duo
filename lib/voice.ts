"use client"

import type { DuoUser } from './constants'
import type { ChatAudio } from './types'

export type RecordedVoice = { blob: Blob; mime: string; durationMs: number; waveform: number[]; url: string }

export const MAX_RECORDING_MS = 5 * 60 * 1000
const BARS = 48

/** AAC in MP4 plays on every phone; WebM/Opus is the fallback (Android, older Chrome). */
function pickMime() {
    if (typeof MediaRecorder === 'undefined') return undefined
    const candidates = ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
    return candidates.find((t) => MediaRecorder.isTypeSupported?.(t))
}

export function canRecordVoice() {
    return typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'
}

export type Recorder = {
    /** Stop and get the recording (null if it was too short) */
    stop: () => Promise<RecordedVoice | null>
    cancel: () => void
    startedAt: number
    /** Live input level 0–1 for the recording UI */
    level: () => number
}

export async function startRecording(): Promise<Recorder> {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    })
    const mime = pickMime()
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : undefined)
    const chunks: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)

    // Sample loudness for the waveform
    const levels: number[] = []
    let current = 0
    let ctx: AudioContext | null = null
    let sampler: ReturnType<typeof setInterval> | undefined
    try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        ctx = new AC()
        // Chrome may create it suspended (outside the original tap); levels would read 0
        ctx.resume().catch(() => { })
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 1024
        ctx.createMediaStreamSource(stream).connect(analyser)
        const buf = new Uint8Array(analyser.fftSize)
        sampler = setInterval(() => {
            analyser.getByteTimeDomainData(buf)
            let sum = 0
            for (const v of buf) sum += ((v - 128) / 128) ** 2
            current = Math.min(1, Math.sqrt(sum / buf.length) * 3)
            levels.push(current)
        }, 60)
    } catch { /* waveform is optional */ }

    const startedAt = Date.now()
    rec.start(250)

    const cleanup = () => {
        clearInterval(sampler)
        stream.getTracks().forEach((t) => t.stop())
        ctx?.close().catch(() => { })
    }

    return {
        startedAt,
        level: () => current,
        cancel: () => {
            rec.onstop = null
            if (rec.state !== 'inactive') rec.stop()
            cleanup()
        },
        stop: () =>
            new Promise((resolve) => {
                const durationMs = Date.now() - startedAt
                rec.onstop = () => {
                    cleanup()
                    if (durationMs < 700 || !chunks.length) return resolve(null)
                    const type = (rec.mimeType || mime || 'audio/webm').split(';')[0]
                    const blob = new Blob(chunks, { type })
                    resolve({ blob, mime: type, durationMs, waveform: downsample(levels, BARS), url: URL.createObjectURL(blob) })
                }
                if (rec.state !== 'inactive') rec.stop()
                else rec.onstop(new Event('stop'))
            }),
    }
}

function downsample(levels: number[], bars: number) {
    if (!levels.length) return Array(bars).fill(8)
    const out: number[] = []
    for (let i = 0; i < bars; i++) {
        const from = Math.floor((i / bars) * levels.length)
        const to = Math.max(from + 1, Math.floor(((i + 1) / bars) * levels.length))
        let peak = 0
        for (let j = from; j < to && j < levels.length; j++) peak = Math.max(peak, levels[j])
        out.push(peak)
    }
    const max = Math.max(0.05, ...out)
    return out.map((v) => Math.max(6, Math.round((v / max) * 100)))
}

export async function uploadVoice(me: DuoUser, v: RecordedVoice): Promise<ChatAudio> {
    const res = await fetch(`/api/images?userId=${me}&duration=${Math.round(v.durationMs)}&wave=${v.waveform.join(',')}`, {
        method: 'POST',
        headers: { 'Content-Type': v.mime },
        body: v.blob,
    })
    if (!res.ok) throw new Error(res.status === 413 ? 'Voice message is too long' : 'Upload failed — check your connection')
    return res.json()
}

export function formatClock(ms: number) {
    const s = Math.max(0, Math.round(ms / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
