"use client"

import type { DuoUser } from './constants'
import type { ChatImage } from './types'

export type PreparedImage = { blob: Blob; width: number; height: number; previewUrl: string }

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
    // createImageBitmap applies EXIF orientation (phone photos are often rotated)
    if ('createImageBitmap' in window) {
        try {
            const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
            return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
        } catch { /* fall back to <img> */ }
    }
    const url = URL.createObjectURL(file)
    try {
        const img = new Image()
        img.decoding = 'async'
        img.src = url
        await img.decode()
        return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
    } catch (e) {
        URL.revokeObjectURL(url)
        throw e
    }
}

/**
 * Resize on the device before upload: photos straight from a phone camera are
 * 3–8 MB; this makes them ~150–400 KB. `square` center-crops (profile pictures).
 */
export async function prepareImage(file: File, opts: { max: number; square?: boolean; quality?: number }): Promise<PreparedImage> {
    if (!file.type.startsWith('image/')) throw new Error('That file isn’t an image')
    const { source, width: sw, height: sh, close } = await decode(file)
    try {
        let sx = 0, sy = 0, cw = sw, ch = sh
        if (opts.square) {
            const side = Math.min(sw, sh)
            sx = (sw - side) / 2
            sy = (sh - side) / 2
            cw = ch = side
        }
        const scale = Math.min(1, opts.max / Math.max(cw, ch))
        const width = Math.max(1, Math.round(cw * scale))
        const height = Math.max(1, Math.round(ch * scale))

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(source, sx, sy, cw, ch, 0, 0, width, height)

        const blob = await new Promise<Blob>((resolve, reject) =>
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process image'))), 'image/jpeg', opts.quality ?? 0.82),
        )
        return { blob, width, height, previewUrl: URL.createObjectURL(blob) }
    } finally {
        close()
    }
}

export async function uploadImage(me: DuoUser, img: PreparedImage): Promise<ChatImage> {
    const res = await fetch(`/api/images?userId=${me}&w=${img.width}&h=${img.height}`, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: img.blob,
    })
    if (!res.ok) throw new Error(res.status === 413 ? 'Photo is too large' : 'Upload failed')
    return res.json()
}
