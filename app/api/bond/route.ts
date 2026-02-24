import { db } from "@/lib/db";
import { loveNotes, users } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusher";
import { desc, eq } from "drizzle-orm";

export async function GET(req: Request) {
    const { getUserName } = await import('@/lib/constants');

    // Fetch all love notes, ordered by newest first
    const rawNotes = await db.select({
        id: loveNotes.id,
        content: loveNotes.content,
        createdAt: loveNotes.createdAt,
        senderId: loveNotes.senderId,
    }).from(loveNotes)
        .orderBy(desc(loveNotes.createdAt))
        .limit(50); // Get last 50 notes

    const notes = rawNotes.map(note => ({
        ...note,
        senderName: getUserName(note.senderId)
    }));

    return NextResponse.json(notes);
}

export async function POST(req: Request) {
    try {
        const { senderId, content } = await req.json();

        if (!senderId || !content) {
            return new NextResponse("Sender ID and content required", { status: 400 });
        }

        // 1. Save note to DB
        const [newNote] = await db.insert(loveNotes).values({
            senderId,
            content
        }).returning();

        // 2. Get sender name for the notification
        const { getUserName } = await import('@/lib/constants');
        const senderName = getUserName(senderId);

        // 3. Trigger Realtime Notification
        await pusherServer.trigger('bond-update', 'new-note', {
            id: newNote.id,
            content: newNote.content,
            senderId: newNote.senderId,
            senderName,
            createdAt: newNote.createdAt
        });

        return NextResponse.json({ success: true, note: newNote });
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
