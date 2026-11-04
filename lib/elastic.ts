"use client"

// iOS-style "rubber band" bounce at the ends of scrolling areas, for Android.
//
// iOS already does this natively for every scroll container. Android Chrome
// only shows a stretch/glow (often not at all inside nested scrollers), so on
// non-Apple touch devices we drive the effect ourselves:
//   - dragging past an edge moves the content with increasing resistance and
//     springs back on release,
//   - a fast fling that hits an edge gets a small bounce.
// One document-level listener covers every screen.

// Scroll extents can be off by ~1px (sub-pixel padding, esp. column-reverse)
const EDGE = 1.5
const SPRING = 'transform 480ms cubic-bezier(0.22, 1, 0.36, 1)'

function isScroller(el: Element): el is HTMLElement {
    if (!(el instanceof HTMLElement)) return false
    const oy = getComputedStyle(el).overflowY
    return (oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight + 1
}

/** Nearest scrollable ancestor, or null when inside a fixed overlay (menus, sheets). */
function findScroller(target: EventTarget | null): HTMLElement | null {
    let el = target instanceof Element ? target : null
    while (el && el !== document.body) {
        if (isScroller(el)) return el
        if (getComputedStyle(el).position === 'fixed') return null
        el = el.parentElement
    }
    return null
}

const isReversed = (el: HTMLElement) => getComputedStyle(el).flexDirection === 'column-reverse'

/** 0 at the top edge … max at the bottom edge, regardless of column-reverse. */
function position(el: HTMLElement) {
    const max = el.scrollHeight - el.clientHeight
    // In column-reverse lists scrollTop runs from 0 (bottom) to -max (top)
    const fromTop = isReversed(el) ? max + el.scrollTop : el.scrollTop
    return { fromTop, max }
}

// iOS's rubber-band curve: resistance grows the further you pull
const rubber = (d: number, dim: number) => Math.sign(d) * (1 - 1 / ((Math.abs(d) * 0.55) / dim + 1)) * dim

export function initElasticScroll() {
    const apple = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && 'ontouchend' in document)
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (apple || !touch) return () => { }

    // Our bounce replaces Android's stretch/glow
    document.documentElement.classList.add('elastic-scroll')

    let el: HTMLElement | null = null
    let lastY = 0
    let startX = 0
    let startY = 0
    let axis: 'x' | 'y' | null = null // sideways swipes (e.g. swipe-to-reply) are ignored
    let anchor: number | null = null // finger Y where the overscroll started
    let offset = 0

    const set = (node: HTMLElement, y: number, animate: boolean) => {
        node.style.transition = animate ? SPRING : 'none'
        node.style.transform = y ? `translate3d(0, ${y}px, 0)` : ''
    }

    const onStart = (e: TouchEvent) => {
        if (e.touches.length !== 1) return
        el = findScroller(e.target)
        lastY = startY = e.touches[0].clientY
        startX = e.touches[0].clientX
        axis = null
        anchor = null
        offset = 0
        if (el) el.style.transition = 'none'
    }

    const onMove = (e: TouchEvent) => {
        if (!el || e.touches.length !== 1) return
        const y = e.touches[0].clientY
        if (axis === null) {
            const ax = Math.abs(e.touches[0].clientX - startX)
            const ay = Math.abs(y - startY)
            if (ax < 6 && ay < 6) return
            axis = ax > ay ? 'x' : 'y'
        }
        if (axis === 'x') return
        const dy = y - lastY
        lastY = y
        const { fromTop, max } = position(el)
        const atTop = fromTop <= EDGE
        const atBottom = fromTop >= max - EDGE

        if (anchor === null) {
            // Start overscrolling when pulling past an edge
            if ((atTop && dy > 0) || (atBottom && dy < 0)) anchor = y - dy
            else return
        }
        const raw = y - anchor
        // Pulled back past the edge: hand control back to normal scrolling
        if ((atTop && !atBottom && raw <= 0) || (atBottom && !atTop && raw >= 0)) {
            anchor = null
            offset = 0
            set(el, 0, false)
            return
        }
        offset = rubber(raw, el.clientHeight)
        set(el, offset, false)
        if (e.cancelable) e.preventDefault() // stop native scroll fighting the pull
    }

    const onEnd = () => {
        if (el && offset) set(el, 0, true)
        el = null
        anchor = null
        offset = 0
    }

    // Fling bounce: watch scroll velocity and bounce when an edge is hit
    const last = new WeakMap<HTMLElement, { pos: number; t: number; v: number }>()
    const onScroll = (e: Event) => {
        const node = e.target
        if (!(node instanceof HTMLElement) || node === el) return // finger-driven handled above
        const { fromTop, max } = position(node)
        const now = performance.now()
        const prev = last.get(node)
        const v = prev ? (fromTop - prev.pos) / Math.max(1, now - prev.t) : 0 // px per ms
        last.set(node, { pos: fromTop, t: now, v })
        const hitTop = fromTop <= EDGE && v < -0.6
        const hitBottom = fromTop >= max - EDGE && v > 0.6
        if (!hitTop && !hitBottom) return
        const amount = Math.min(36, Math.abs(v) * 14) * (hitTop ? 1 : -1)
        node.animate(
            [{ transform: 'translate3d(0,0,0)' }, { transform: `translate3d(0, ${amount}px, 0)` }, { transform: 'translate3d(0,0,0)' }],
            { duration: 520, easing: 'cubic-bezier(0.25, 0.9, 0.3, 1)' },
        )
        last.set(node, { pos: fromTop, t: now, v: 0 })
    }

    document.addEventListener('touchstart', onStart, { passive: true })
    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd, { passive: true })
    document.addEventListener('touchcancel', onEnd, { passive: true })
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })

    return () => {
        document.documentElement.classList.remove('elastic-scroll')
        document.removeEventListener('touchstart', onStart)
        document.removeEventListener('touchmove', onMove)
        document.removeEventListener('touchend', onEnd)
        document.removeEventListener('touchcancel', onEnd)
        document.removeEventListener('scroll', onScroll, { capture: true })
    }
}
