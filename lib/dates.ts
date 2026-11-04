// Client-side date helpers. "Today" is always the user's LOCAL day.

export function todayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function timesLabel(n: number) {
    if (n <= 0) return 'Not yet';
    if (n === 1) return 'Once';
    if (n === 2) return 'Twice';
    if (n === 3) return 'Thrice';
    return `${n} times`;
}

/** "Prayed twice" / "Not yet today" */
export function prayedText(n: number) {
    return n <= 0 ? 'Not yet today' : `Prayed ${timesLabel(n).toLowerCase()}`
}

export function greeting(d = new Date()) {
    const h = d.getHours();
    if (h < 5) return 'Good night';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}

export function dayLabel(iso: string) {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    const sameYear = date.getFullYear() === today.getFullYear();
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
}

export function timeLabel(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function relativeLabel(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.round(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Short weekday letter for a YYYY-MM-DD key */
export function weekdayInitial(dateKey: string) {
    return new Date(`${dateKey}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
}
