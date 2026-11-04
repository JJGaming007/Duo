import { Fragment } from 'react'

export const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|‍|️|\s)+$/u
const URL_RE = /(https?:\/\/[^\s]+)/g

/** Plain text with clickable links */
export function renderText(text: string, highlight?: string) {
    return text.split(URL_RE).map((part, i) =>
        i % 2 === 1 ? (
            <a key={i} href={part} target="_blank" rel="noreferrer" className="underline underline-offset-2" onClick={(e) => e.stopPropagation()}>
                {part}
            </a>
        ) : (
            <Fragment key={i}>{highlight ? mark(part, highlight) : part}</Fragment>
        ),
    )
}

/** Highlight search matches */
export function mark(text: string, q: string) {
    if (!q) return text
    const lower = text.toLowerCase()
    const needle = q.toLowerCase()
    const out: React.ReactNode[] = []
    let i = 0
    let at = lower.indexOf(needle)
    while (at !== -1) {
        out.push(text.slice(i, at), <mark key={at} className="rounded bg-accent/40 text-white">{text.slice(at, at + q.length)}</mark>)
        i = at + q.length
        at = lower.indexOf(needle, i)
    }
    out.push(text.slice(i))
    return out
}

export const isEmojiOnly = (text: string) => !!text && text.length <= 16 && EMOJI_ONLY.test(text)
