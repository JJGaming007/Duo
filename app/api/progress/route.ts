import { db } from "@/lib/db";
import { dailyProgress, streaks, users } from "@/lib/db/schema";
import { NextResponse } from "next/server";
import { eq, desc, and } from "drizzle-orm";
import { pusherServer } from "@/lib/pusher";
import { seedUsers } from "@/lib/db/seed";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) return new NextResponse("User ID required", { status: 400 });

    await seedUsers(); // Ensure users exist

    const progress = await db.select().from(dailyProgress).where(eq(dailyProgress.userId, userId));
    return NextResponse.json(progress);
}

export async function POST(req: Request) {
    const body = await req.json();
    const { userId, courseDay, watched, practiced, projectDone, timeSpentMinutes, notes } = body;

    if (!userId) return new NextResponse("User ID required", { status: 400 });

    await seedUsers();

    const today = new Date().toISOString().split('T')[0];

    try {
        // 1. Save progress
        await db.insert(dailyProgress).values({
            userId,
            courseDay,
            watched,
            practiced,
            projectDone,
            timeSpentMinutes,
            notes,
            date: today,
        }).onConflictDoUpdate({
            target: [dailyProgress.userId, dailyProgress.courseDay],
            set: { watched, practiced, projectDone, timeSpentMinutes, notes, date: today }
        });

        // 2. Update Streak
        const userStreak = await db.query.streaks.findFirst({
            where: eq(streaks.userId, userId)
        });

        const newStreak = (userStreak?.currentStreak || 0) + 1;
        const newLongest = Math.max(userStreak?.longestStreak || 0, newStreak);

        await db.insert(streaks).values({
            userId,
            currentStreak: newStreak,
            longestStreak: newLongest,
            lastCompletedDate: today,
        }).onConflictDoUpdate({
            target: [streaks.userId],
            set: { currentStreak: newStreak, longestStreak: newLongest, lastCompletedDate: today, updatedAt: new Date() }
        });

        // 3. Increment XP
        let xpToAdd = 0;
        if (watched) xpToAdd += 50;
        if (practiced) xpToAdd += 50;
        if (projectDone) xpToAdd += 100;

        if (xpToAdd > 0) {
            const userRecord = await db.query.users.findFirst({ where: eq(users.id, userId) });
            await db.update(users).set({ xp: (userRecord?.xp || 0) + xpToAdd }).where(eq(users.id, userId));
        }

        // 4. Trigger Realtime Notification
        await pusherServer.trigger('partner-progress', 'log-complete', {
            userId,
            userName: userId === 'user-1' ? 'Partner A' : 'Partner B',
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
