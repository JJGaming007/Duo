"use client"

import type { DuoUser } from './constants'
import type { ChatImage } from './types'

export type PreparedImage = { blob: Blob; width: number; height: number; previewUrl: string }

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void }

/** <img> + onload. (Not img.decode(): Safari rejects it with "The source image
 *  cannot be decoded" for many large camera photos it can display fine.) */
function loadWithImg(file: Blob): Promise<Decoded> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
            if (!img.naturalWidth || !img.naturalHeight) {
                URL.revokeObjectURL(url)
                reject(new Error('empty image'))
                return
            }
            resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) })
        }
        img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('img load failed'))
        }
        img.src = url
    })
}

async function loadWithBitmap(file: Blob): Promise<Decoded> {
    // `imageOrientation` keeps EXIF rotation; older Safari rejects the options object
    let bmp: ImageBitmap
    try {
        bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
        bmp = await createImageBitmap(file)
    }
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() }
}

const isApple = () => /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent) && 'ontouchend' in document

async function decode(file: Blob): Promise<Decoded> {
    // Safari's <img> decoder is the most capable there (HEIC, EXIF rotation);
    // elsewhere createImageBitmap is faster and off the main thread.
    const order = isApple() || !('createImageBitmap' in window) ? [loadWithImg, loadWithBitmap] : [loadWithBitmap, loadWithImg]
    let last: unknown
    for (const fn of order) {
        try {
            return await fn(file)
        } catch (e) {
            last = e
        }
    }
    throw last
}

const UPLOADABLE = new Set(['image/jpeg', 'image/png', 'image/webp'])
const RAW_LIMIT = 3 * 1024 * 1024
const isHeic = (f: File) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)

/**
 * Resize on the device before upload: photos straight from a phone camera are
 * 3–8 MB; this makes them ~150–400 KB. `square` center-crops (profile pictures).
 */
export async function prepareImage(file: File, opts: { max: number; square?: boolean; quality?: number }): Promise<PreparedImage> {
    // Some Android pickers give an empty type, so only reject clear non-images
    if (file.type && !file.type.startsWith('image/')) throw new Error('That file isn’t a photo')

    let decoded: Decoded
    try {
        decoded = await decode(file)
    } catch {
        // Can't decode here — send the original if the server can take it as-is
        if (!opts.square && UPLOADABLE.has(file.type) && file.size <= RAW_LIMIT) {
            return { blob: file, width: 0, height: 0, previewUrl: URL.createObjectURL(file) }
        }
        throw new Error(
            isHeic(file)
                ? 'This phone can’t open HEIC photos here. Try a screenshot of it, or set Camera → Formats → Most Compatible.'
                : 'Couldn’t open that photo. Try a different one.',
        )
    }

    const { source, width: sw, height: sh, close } = decoded
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
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Couldn’t process that photo')
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(source, sx, sy, cw, ch, 0, 0, width, height)

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', opts.quality ?? 0.82))
        if (!blob) throw new Error('Couldn’t process that photo')
        return { blob, width, height, previewUrl: URL.createObjectURL(blob) }
    } finally {
        close()
    }
}

export async function uploadImage(me: DuoUser, img: PreparedImage): Promise<ChatImage> {
    const type = img.blob.type && UPLOADABLE.has(img.blob.type) ? img.blob.type : 'image/jpeg'
    const res = await fetch(`/api/images?userId=${me}&w=${img.width}&h=${img.height}`, {
        method: 'POST',
        headers: { 'Content-Type': type },
        body: img.blob,
    })
    if (!res.ok) throw new Error(res.status === 413 ? 'That photo is too large' : 'Upload failed — check your connection')
    return res.json()
}
