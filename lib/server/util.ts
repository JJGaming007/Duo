import { NextResponse } from 'next/server';
import type { DuoUser } from '@/lib/constants';

export function isDuoUser(id: unknown): id is DuoUser {
    return id === 'user-1' || id === 'user-2';
}

export const partnerOf = (id: DuoUser): DuoUser => (id === 'user-1' ? 'user-2' : 'user-1');

export function badRequest(message: string) {
    return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(error: unknown) {
    console.error(error);
    const message = error instanceof Error ? error.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
}

/** YYYY-MM-DD (the client sends its local date so "today" matches the user's day) */
export function isDateKey(v: unknown): v is string {
    return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function addDays(dateKey: string, days: number) {
    const d = new Date(`${dateKey}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
