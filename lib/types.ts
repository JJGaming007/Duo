// Shapes shared between API routes and the client

export type ChatMessage = {
    id: string;
    content: string;
    senderId: string;
    senderName: string;
    createdAt: string;
    replyToId: string | null;
    replyTo: { id: string; content: string; senderId: string; senderName: string } | null;
    readAt: string | null;
    reactions: Record<string, string>;
    image: ChatImage | null;
    /** Set on optimistic messages / echoed back by the server */
    clientId?: string;
    pending?: boolean;
    failed?: boolean;
};

export type ChatImage = { id: string; url: string; width: number; height: number };

export type PrayerDay = { date: string; 'user-1': number; 'user-2': number };

export type PrayerSummary = {
    date: string;
    today: { 'user-1': number; 'user-2': number };
    /** Last 7 days, oldest first, ending today */
    week: PrayerDay[];
    streaks: { 'user-1': number; 'user-2': number };
};

export type PrayerSubject = {
    id: string;
    title: string;
    notes: string | null;
    createdBy: string;
    forWhom: 'both' | 'user-1' | 'user-2';
    prayedCount: number;
    lastPrayedAt: string | null;
    answeredAt: string | null;
    createdAt: string;
};

export type DuoMember = {
    id: string;
    name: string;
    moodEmoji: string | null;
    moodLabel: string | null;
    moodUpdatedAt: string | null;
    /** Profile picture URL (/api/images/<id>) */
    image: string | null;
};
